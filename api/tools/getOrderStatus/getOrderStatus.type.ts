export interface OrderDetails {
    orderNumber: string;
    status: string;
    tracking_numbers: string[];
}

export interface ShipmentInfo {
    tracking_number: string;
    carrier_code: string;
    title: string;
}