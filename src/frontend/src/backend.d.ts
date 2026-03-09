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
export interface UserProfile {
    id: string;
    totalOrders: bigint;
    createdAt: bigint;
    role: UserRole;
    invitedBy?: string;
    fullName: string;
    email: string;
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
export interface Category {
    id: string;
    catCn: string;
    catEn: string;
    catId: string;
    createdAt: bigint;
    updatedAt: bigint;
    subCat: string;
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
export interface Customer {
    id: string;
    name: string;
    createdAt: bigint;
    contactPerson: string;
    email: string;
    address: string;
    phone: string;
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
export interface AppUser {
    id: string;
    totalOrders: bigint;
    joinDate: string;
    createdAt: bigint;
    role: string;
    fullName: string;
    email: string;
    passwordHash: string;
    canEditContainers: boolean;
    mustChangePassword: boolean;
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
export interface ExtendedProduct {
    bbd: string;
    sku: string;
    uom: string;
    vat: number;
    categoryId: string;
    promotions: string;
    nameEn: string;
    imageFileName: string;
    size: string;
    updatedAt: bigint;
    stock: bigint;
    brand: string;
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
export enum UserRole {
    salesRep = "salesRep",
    admin = "admin"
}
export enum UserRole__1 {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addContainerItem(item: ContainerItem): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole__1): Promise<void>;
    createAdminUser(id: string, email: string, fullName: string): Promise<void>;
    createContainer(id: string, containerNo: string, shipper: string, eta: string, entryPort: string, status: string, notes: string): Promise<void>;
    createProduct(id: string, sku: string, nameCnSimplified: string, nameCnTraditional: string, category: string, price: number, stockStatus: string, imageBlob: ExternalBlob | null): Promise<void>;
    deleteAppUser(email: string): Promise<void>;
    deleteCategoryData(catId: string): Promise<void>;
    deleteContainer(id: string): Promise<void>;
    deleteProduct(sku: string): Promise<void>;
    getAdminStats(): Promise<{
        totalProducts: bigint;
        totalOrders: bigint;
        pendingOrders: bigint;
        submittedOrders: bigint;
        totalUsers: bigint;
        totalCustomers: bigint;
        syncedOrders: bigint;
    }>;
    getAllAppUsers(): Promise<Array<AppUser>>;
    getAllCategoriesData(): Promise<Array<Category>>;
    getAllContainers(): Promise<Array<Container>>;
    getAllCustomers(): Promise<Array<Customer>>;
    getAllExtendedProductsData(): Promise<Array<ExtendedProduct>>;
    getAllOrders(): Promise<Array<Order>>;
    getAllProducts(): Promise<Array<Product>>;
    getAppUserByEmail(email: string): Promise<AppUser | null>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole__1>;
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
    getUserProfile(userId: string): Promise<UserProfile | null>;
    getUserRole(userId: string): Promise<UserRole>;
    incrementUserOrderCount(userId: string): Promise<void>;
    inviteUser(id: string, email: string, fullName: string, invitedBy: string | null): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    removeContainerItem(id: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    seedData(): Promise<void>;
    submitOrder(order: Order, items: Array<OrderItem>): Promise<void>;
    syncOrder(orderId: string): Promise<void>;
    updateAppUserPassword(email: string, newPassword: string): Promise<void>;
    updateContainer(id: string, containerNo: string, shipper: string, eta: string, entryPort: string, status: string, notes: string): Promise<void>;
    updateContainerItem(item: ContainerItem): Promise<void>;
    updateProductImage(sku: string, imageBlob: ExternalBlob): Promise<void>;
    upsertAppUser(user: AppUser): Promise<void>;
    upsertCategory(category: Category): Promise<void>;
    upsertCustomer(customer: Customer): Promise<void>;
    upsertExtendedProduct(ep: ExtendedProduct): Promise<void>;
    upsertProductBySku(product: Product): Promise<void>;
}
