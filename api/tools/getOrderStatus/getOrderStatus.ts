// src/modules/magento/magento.module.ts
import { OrderDetails, ShipmentInfo } from "./getOrderStatus.type"
import { Env } from "../../index";

export function getOrderStatusTool(env: Env) {
    return {
        name: "getOrderStatus",
        description: "Checks order status from Magento.",
        parameters: {
            type: "object",
            properties: {
                orderNumber: {
                    type: "string",
                    description: "Customer's order number"
                }
            },
            required: ["orderNumber"]
        },
        function: async ({ orderNumber, }: { orderNumber: string }) => {
            return await getOrderInfoFn(orderNumber, env);
        }
    }
}

async function getOrderInfoFn(orderNumber: string, env: Env): Promise<OrderDetails| string | null > {
    const baseUrl = env.MAGENTO_API_URL;
    const apiToken = env.MAGENTO_API_TOKEN;

    if (!orderNumber){
        return "I need your order number to check the status. Could you please provide it?"
    }

    try {
        console.log(`Fetching order details for ${orderNumber}`);
        // Use searchCriteria to find order by increment_id
        const url = `${baseUrl}/rest/V1/orders?searchCriteria[filterGroups][0][filters][0][field]=increment_id&` +
            `searchCriteria[filterGroups][0][filters][0][value]=${orderNumber}&` +
            `searchCriteria[filterGroups][0][filters][0][condition_type]=eq`;
        console.log(`API URL: ${url}`);
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.log('not ok');
            throw new Error(`Magento API error: ${response.statusText}`);
        }

        const data: any = await response.json();
        let order;
        try {
            // Since we're using searchCriteria, we need to check the items array
            if (!data.items || data.items.length === 0) {
                console.log('No order found with the given increment_id');
                return null;
            }

            // Use the first matching order
            order = data.items[0];
        } catch (e) {
            throw new Error(`Invalid JSON response from Magento API`);
        }

        const trackingInfo = await getTrackingInfo(order.entity_id, baseUrl, apiToken);
        const orderDetails = formatOrderDetails(order, trackingInfo);
        console.log('orderDetails', orderDetails)
        return orderDetails
    } catch (error) {
        console.error('Error fetching order details:', error);
        throw new Error('Failed to fetch order details');
    }

}

async function getTrackingInfo(orderId: string, baseUrl: string, apiToken: string): Promise<ShipmentInfo[]> {
    try {
        console.log('shipping url', `${baseUrl}/rest/V1/shipments?searchCriteria[filterGroups][0][filters][0][field]=order_id&` +
            `searchCriteria[filterGroups][0][filters][0][value]=${orderId}`)
        const response = await fetch(
            `${baseUrl}/rest/V1/shipments?searchCriteria[filterGroups][0][filters][0][field]=order_id&` +
            `searchCriteria[filterGroups][0][filters][0][value]=${orderId}`, {
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
        })
        if (!response.ok) {
            throw new Error(`Magento API error: ${response.statusText}`);
        }

        const data: any = await response.json();
        const tracks: ShipmentInfo[] = [];

        if (data.items && data.items.length > 0) {
            data.items.forEach((shipment: any) => {
                console.log('shipment data', shipment)
                if (shipment.tracks && shipment.tracks.length > 0) {
                    tracks.push(...shipment.tracks.map((track: any) => ({
                        tracking_number: track.track_number,
                        carrier_code: track.carrier_code,
                        title: track.title
                    })))
                }
            })
        }
        return tracks
    } catch (error) {
        console.error('Error fetching tracking info:', error);
        return []
    }

}

function formatOrderDetails(magentoOrder: any, trackingInfo: ShipmentInfo[]): OrderDetails {
    return {
        orderNumber: magentoOrder.increment_id,
        status: magentoOrder.status,
        tracking_numbers: trackingInfo.map(track => track.tracking_number),
    }
}
