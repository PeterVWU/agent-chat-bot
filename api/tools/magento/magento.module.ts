// src/modules/magento/magento.module.ts
import { MagentoModule, OrderDetails, ShipmentInfo } from "./magento.interface"

export class CSMagentoModule implements MagentoModule {
    private baseUrl: string;
    private apiToken: string;

    constructor(env: {
        MAGENTO_API_URL: string,
        MAGENTO_API_TOKEN: string
    }) {
        this.baseUrl = env.MAGENTO_API_URL;
        this.apiToken = env.MAGENTO_API_TOKEN;
    }
    public async getOrderInfo(orderNumber: string): Promise<OrderDetails | null> {
        try {

            console.log(`Fetching order details for ${orderNumber}`);
            // Use searchCriteria to find order by increment_id
            const url = `${this.baseUrl}/rest/V1/orders?searchCriteria[filterGroups][0][filters][0][field]=increment_id&` +
                `searchCriteria[filterGroups][0][filters][0][value]=${orderNumber}&` +
                `searchCriteria[filterGroups][0][filters][0][condition_type]=eq`;
            console.log(`API URL: ${url}`);
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                console.log('not ok');
                throw new Error(`Magento API error: ${response.statusText}`);
            }

            const data: any = await response.json();
            console.log('done response:', data);
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

            const trackingInfo = await this.getTrackingInfo(orderNumber);
            return this.formatOrderDetails(order, trackingInfo);
        } catch (error) {
            console.error('Error fetching order details:', error);
            throw new Error('Failed to fetch order details');
        }
    }

    private async getTrackingInfo(orderNumber: string): Promise<ShipmentInfo[]> {
        try {
            const response = await fetch(
                `${this.baseUrl}/rest/V1/shipments?searchCriteria[filterGroups][0][filters][0][field]=increment_id&` +
                `searchCriteria[filterGroups][0][filters][0][value]=${orderNumber}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
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

    private formatOrderDetails(magentoOrder: any, trackingInfo: ShipmentInfo[]): OrderDetails {
        console.log('formatOrderDetails:', magentoOrder, trackingInfo);
        return {
            orderNumber: magentoOrder.increment_id,
            status: magentoOrder.status,
            // items: magentoOrder.items.map((item: any) => ({
            //     name: item.name,
            //     quantity: item.qty_ordered,
            //     price: item.price
            // })),
            shipping: {
                method: magentoOrder.shipping_description,
                tracking: trackingInfo.map(track => ({
                    number: track.tracking_number,
                    carrier: track.carrier_code
                })),
            },
            totals: {
                subtotal: magentoOrder.subtotal,
                shipping: magentoOrder.shipping_amount,
                tax: magentoOrder.tax_amount,
                total: magentoOrder.grand_total
            },
            dates: {
                ordered: magentoOrder.created_at,
                updated: magentoOrder.updated_at
            }
        }
    }
}