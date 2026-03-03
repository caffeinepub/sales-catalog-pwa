import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface ContainerItem {
    id: string;
    bbd: string;
    qty: bigint;
    containerId: string;
    productSku: string;
    sellingPrice: number;
    productName: string;
}
export interface Container {
    id: string;
    eta: string;
    shipper: string;
    status: string;
    entryPort: string;
    containerNo: string;
    createdAt: bigint;
    updatedAt: bigint;
    notes: string;
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
    imageBlob?: ExternalBlob;
    stockStatus: string;
    createdAt: bigint;
    nameCnSimplified: string;
    updatedAt: bigint;
    category: string;
    price: number;
    nameCnTraditional: string;
}
export enum UserRole {
    salesRep = "salesRep",
    admin = "admin"
}
export interface backendInterface {
    addContainerItem(item: ContainerItem): Promise<void>;
    createAdminUser(id: string, email: string, fullName: string): Promise<void>;
    createContainer(id: string, containerNo: string, shipper: string, eta: string, entryPort: string, status: string, notes: string): Promise<void>;
    createProduct(id: string, sku: string, nameCnSimplified: string, nameCnTraditional: string, category: string, price: number, stockStatus: string, imageBlob: ExternalBlob | null): Promise<void>;
    deleteContainer(id: string): Promise<void>;
    getAdminStats(): Promise<{
        totalProducts: bigint;
        totalOrders: bigint;
        pendingOrders: bigint;
        submittedOrders: bigint;
        totalUsers: bigint;
        totalCustomers: bigint;
        syncedOrders: bigint;
    }>;
    getAllContainers(): Promise<Array<Container>>;
    getAllOrders(): Promise<Array<Order>>;
    getContainer(id: string): Promise<Container | null>;
    getContainerItems(containerId: string): Promise<Array<ContainerItem>>;
    getOrdersByUser(userId: string): Promise<Array<Order>>;
    getProductBySku(sku: string): Promise<Product>;
    getProductImage(sku: string): Promise<ExternalBlob | null>;
    getTotalCounts(): Promise<{
        orders: bigint;
        users: bigint;
        products: bigint;
        customers: bigint;
    }>;
    getUserRole(userId: string): Promise<UserRole>;
    incrementUserOrderCount(userId: string): Promise<void>;
    inviteUser(id: string, email: string, fullName: string, invitedBy: string | null): Promise<void>;
    removeContainerItem(id: string): Promise<void>;
    seedData(): Promise<void>;
    submitOrder(order: Order, items: Array<OrderItem>): Promise<void>;
    syncOrder(orderId: string): Promise<void>;
    updateContainer(id: string, containerNo: string, shipper: string, eta: string, entryPort: string, status: string, notes: string): Promise<void>;
    updateContainerItem(item: ContainerItem): Promise<void>;
    updateProductImage(sku: string, imageBlob: ExternalBlob): Promise<void>;
    upsertProductBySku(product: Product): Promise<void>;
}
