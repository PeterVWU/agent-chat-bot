export interface OrderDetails {
    orderNumber: string;
    status: string;
    // items: Array<{
    //     name: string;
    //     quantity: number;
    //     price: number;
    // }>;
    shipping: {
        method: string;
        tracking?: {
            number: string;
            carrier: string;
        }[];
    };
    totals: {
        subtotal: number;
        shipping: number;
        tax: number;
        total: number;
    };
    dates: {
        ordered: string;
        updated?: string;
    };
}

export interface ShipmentInfo {
    tracking_number: string;
    carrier_code: string;
    title: string;
}