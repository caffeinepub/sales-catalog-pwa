import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Order {
    id: string;
    customerName: string;
    status: string;
    createdAt: bigint;
    salesRepId: string;
    orderDate: bigint;
    syncedAt?: bigint;
    totalAmount: number;
    customerId: string;
    salesRepName: string;
}
export interface Product {
    id: string;
    sku: string;
    stockStatus: string;
    createdAt: bigint;
    nameCnSimplified: string;
    updatedAt: bigint;
    imageUrl: string;
    category: string;
    price: number;
    nameCnTraditional: string;
}
export interface OrderItem {
    id: string;
    sku: string;
    productId: string;
    productName: string;
    orderId: string;
    quantity: bigint;
    unitPrice: number;
    subtotal: number;
}
export enum UserRole {
    salesRep = "salesRep",
    admin = "admin"
}
export interface backendInterface {
    createAdminUser(id: string, email: string, fullName: string): Promise<void>;
    getAdminStats(): Promise<{
        totalProducts: bigint;
        totalOrders: bigint;
        pendingOrders: bigint;
        submittedOrders: bigint;
        totalUsers: bigint;
        totalCustomers: bigint;
        syncedOrders: bigint;
    }>;
    getAllOrders(): Promise<Array<Order>>;
    getOrdersByUser(userId: string): Promise<Array<Order>>;
    getProductsBySku(sku: string): Promise<Product>;
    getTotalCounts(): Promise<{
        orders: bigint;
        users: bigint;
        products: bigint;
        customers: bigint;
    }>;
    getUserRole(userId: string): Promise<UserRole>;
    incrementUserOrderCount(userId: string): Promise<void>;
    inviteUser(id: string, email: string, fullName: string, invitedBy: string | null): Promise<void>;
    seedData(): Promise<void>;
    submitOrder(order: Order, items: Array<OrderItem>): Promise<void>;
    syncOrder(orderId: string): Promise<void>;
    upsertProductBySku(product: Product): Promise<void>;
}
