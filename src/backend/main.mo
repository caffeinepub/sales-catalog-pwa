import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Array "mo:core/Array";
import Float "mo:core/Float";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Storage "blob-storage/Storage";
import AccessControl "authorization/access-control";

import MixinStorage "blob-storage/Mixin";
import MixinAuthorization "authorization/MixinAuthorization";


actor {
  // Access Control
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // TYPES
  type UserRole = {
    #admin;
    #salesRep;
  };

  type UserProfile = {
    id : Text;
    email : Text;
    fullName : Text;
    role : UserRole;
    totalOrders : Nat;
    invitedBy : ?Text;
    createdAt : Int;
  };

  type Product = {
    id : Text;
    sku : Text;
    nameCnSimplified : Text;
    nameCnTraditional : Text;
    category : Text;
    price : Float;
    stockStatus : Text;
    imageBlob : ?Storage.ExternalBlob;
    createdAt : Int;
    updatedAt : Int;
  };

  type Customer = {
    id : Text;
    name : Text;
    contactPerson : Text;
    phone : Text;
    email : Text;
    address : Text;
    createdAt : Int;
  };

  type Order = {
    id : Text;
    orderDate : Int;
    salesRepId : Text;
    salesRepName : Text;
    customerId : Text;
    customerName : Text;
    status : Text;
    totalAmount : Float;
    syncedAt : ?Int;
    createdAt : Int;
  };

  type OrderItem = {
    id : Text;
    orderId : Text;
    productId : Text;
    sku : Text;
    productName : Text;
    quantity : Nat;
    unitPrice : Float;
    subtotal : Float;
  };

  type Category = {
    id : Text;
    catId : Text;
    catEn : Text;
    catCn : Text;
    subCat : Text;
    createdAt : Int;
    updatedAt : Int;
  };

  type ExtendedProduct = {
    sku : Text;
    nameEn : Text;
    brand : Text;
    categoryId : Text;
    size : Text;
    bbd : Text;
    vat : Float;
    uom : Text;
    stock : Nat;
    promotions : Text;
    imageFileName : Text;
    updatedAt : Int;
  };

  type AppUser = {
    id : Text;
    email : Text;
    fullName : Text;
    role : Text;
    passwordHash : Text;
    mustChangePassword : Bool;
    canEditContainers : Bool;
    totalOrders : Nat;
    joinDate : Text;
    createdAt : Int;
  };

  type Container = {
    id : Text;
    containerNo : Text;
    shipper : Text;
    eta : Text;
    entryPort : Text;
    status : Text;
    notes : Text;
    createdAt : Int;
    updatedAt : Int;
  };

  type ContainerItem = {
    id : Text;
    containerId : Text;
    productSku : Text;
    productName : Text;
    qty : Nat;
    sellingPrice : Float;
    bbd : Text;
  };

  module Product {
    public func compare(a : Product, b : Product) : Order.Order {
      Text.compare(a.id, b.id);
    };

    public func compareBySku(a : Product, b : Product) : Order.Order {
      Text.compare(a.sku, b.sku);
    };
  };

  // STATE - Persistent Data Stores
  let users = Map.empty<Text, UserProfile>();
  let userPrincipalMap = Map.empty<Principal, Text>();
  let products = Map.empty<Text, Product>();
  let customers = Map.empty<Text, Customer>();
  let orders = Map.empty<Text, Order>();
  let orderItems = Map.empty<Text, OrderItem>();
  let categories = Map.empty<Text, Category>();
  let extendedProducts = Map.empty<Text, ExtendedProduct>();
  let appUsers = Map.empty<Text, AppUser>();
  let containers = Map.empty<Text, Container>();
  let containerItems = Map.empty<Text, ContainerItem>();

  include MixinStorage();

  // Helper Functions
  private func getUserIdFromPrincipal(caller : Principal) : ?Text {
    userPrincipalMap.get(caller);
  };

  private func isUserAdmin(userId : Text) : Bool {
    switch (users.get(userId)) {
      case (null) { false };
      case (?user) { user.role == #admin };
    };
  };

  // USER PROFILE FUNCTIONS (Required by frontend)
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    switch (getUserIdFromPrincipal(caller)) {
      case (null) { null };
      case (?userId) { users.get(userId) };
    };
  };

  public query ({ caller }) func getUserProfile(userId : Text) : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };

    // Users can view their own profile, admins can view any profile
    switch (getUserIdFromPrincipal(caller)) {
      case (null) { Runtime.trap("User not found") };
      case (?callerUserId) {
        if (callerUserId != userId and not isUserAdmin(callerUserId)) {
          Runtime.trap("Unauthorized: Can only view your own profile");
        };
        users.get(userId);
      };
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };

    switch (getUserIdFromPrincipal(caller)) {
      case (null) { Runtime.trap("User not found") };
      case (?userId) {
        if (userId != profile.id) {
          Runtime.trap("Unauthorized: Can only update your own profile");
        };
        users.add(profile.id, profile);
      };
    };
  };

  // PRODUCT MANAGEMENT
  public shared ({ caller }) func createProduct(
    id : Text,
    sku : Text,
    nameCnSimplified : Text,
    nameCnTraditional : Text,
    category : Text,
    price : Float,
    stockStatus : Text,
    imageBlob : ?Storage.ExternalBlob
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create products");
    };

    let product : Product = {
      id;
      sku;
      nameCnSimplified;
      nameCnTraditional;
      category;
      price;
      stockStatus;
      imageBlob;
      createdAt = Time.now();
      updatedAt = Time.now();
    };
    products.add(sku, product);
  };

  public shared ({ caller }) func updateProductImage(sku : Text, imageBlob : Storage.ExternalBlob) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update product images");
    };

    switch (products.get(sku)) {
      case (null) { Runtime.trap("Product does not exist") };
      case (?product) {
        let updatedProduct = {
          product with
          imageBlob = ?imageBlob;
          updatedAt = Time.now();
        };
        products.add(sku, updatedProduct);
      };
    };
  };

  public query ({ caller }) func getProductImage(sku : Text) : async ?Storage.ExternalBlob {
    // Public access - no auth check needed
    switch (products.get(sku)) {
      case (null) { Runtime.trap("Product does not exist") };
      case (?product) { product.imageBlob };
    };
  };

  public query ({ caller }) func getProductBySku(sku : Text) : async Product {
    // Public access - no auth check needed
    switch (products.get(sku)) {
      case (null) { Runtime.trap("Product does not exist") };
      case (?product) { product };
    };
  };

  public shared ({ caller }) func upsertProductBySku(product : Product) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can upsert products");
    };

    switch (products.get(product.sku)) {
      case (null) {
        products.add(product.sku, product);
      };
      case (?existingProduct) {
        let updatedProduct : Product = {
          existingProduct with
          nameCnSimplified = product.nameCnSimplified;
          nameCnTraditional = product.nameCnTraditional;
          category = product.category;
          price = product.price;
          stockStatus = product.stockStatus;
          imageBlob = product.imageBlob;
          updatedAt = Time.now();
        };
        products.add(product.sku, updatedProduct);
      };
    };
  };

  public shared ({ caller }) func deleteProduct(sku : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete products");
    };

    switch (products.get(sku)) {
      case (null) { Runtime.trap("Product with sku " # sku # " does not exist yet.") };
      case (?_) {
        products.remove(sku);
      };
    };
  };

  public query ({ caller }) func getAllProducts() : async [Product] {
    // Public access - no auth check needed
    products.values().toArray();
  };

  // USER PROFILE MANAGEMENT
  public shared ({ caller }) func inviteUser(id : Text, email : Text, fullName : Text, invitedBy : ?Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can invite users");
    };

    let user : UserProfile = {
      id;
      email;
      fullName;
      role = #salesRep;
      totalOrders = 0;
      invitedBy;
      createdAt = Time.now();
    };
    users.add(id, user);
  };

  public shared ({ caller }) func createAdminUser(id : Text, email : Text, fullName : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can create admin users");
    };

    let user : UserProfile = {
      id;
      email;
      fullName;
      role = #admin;
      totalOrders = 0;
      invitedBy = null;
      createdAt = Time.now();
    };
    users.add(id, user);
  };

  public query ({ caller }) func getUserRole(userId : Text) : async UserRole {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view user roles");
    };

    switch (users.get(userId)) {
      case (null) { Runtime.trap("User does not exist") };
      case (?userProfile) { userProfile.role };
    };
  };

  public shared ({ caller }) func incrementUserOrderCount(userId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can increment order counts");
    };

    switch (users.get(userId)) {
      case (null) { Runtime.trap("User does not exist") };
      case (?userProfile) {
        let updatedProfile : UserProfile = {
          userProfile with
          totalOrders = userProfile.totalOrders + 1;
        };
        users.add(userId, updatedProfile);
      };
    };
  };

  // CUSTOMER MANAGEMENT
  public query ({ caller }) func getAllCustomers() : async [Customer] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view customers");
    };

    customers.values().toArray();
  };

  public shared ({ caller }) func upsertCustomer(customer : Customer) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can upsert customers");
    };

    switch (customers.get(customer.id)) {
      case (null) {
        customers.add(customer.id, customer);
      };
      case (?existingCustomer) {
        let updatedCustomer : Customer = {
          existingCustomer with
          name = customer.name;
          contactPerson = customer.contactPerson;
          phone = customer.phone;
          email = customer.email;
          address = customer.address;
        };
        customers.add(customer.id, updatedCustomer);
      };
    };
  };

  // ORDER MANAGEMENT
  public shared ({ caller }) func submitOrder(order : Order, items : [OrderItem]) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can submit orders");
    };

    // Verify the user is submitting their own order
    switch (getUserIdFromPrincipal(caller)) {
      case (null) { Runtime.trap("User not found") };
      case (?userId) {
        if (order.salesRepId != userId and not isUserAdmin(userId)) {
          Runtime.trap("Unauthorized: Can only submit your own orders");
        };
      };
    };

    let totalAmount = items.foldLeft(0.0, func(acc, item) { acc + item.subtotal });
    let updatedOrder : Order = {
      order with
      totalAmount;
    };

    orders.add(order.id, updatedOrder);

    for (item in items.values()) {
      orderItems.add(item.id, item);
    };
  };

  public shared ({ caller }) func syncOrder(orderId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can sync orders");
    };

    switch (orders.get(orderId)) {
      case (null) { Runtime.trap("Order does not exist") };
      case (?order) {
        let updatedOrder : Order = {
          order with
          status = "synced";
          syncedAt = ?Time.now();
        };
        orders.add(orderId, updatedOrder);
      };
    };
  };

  public query ({ caller }) func getOrdersByUser(userId : Text) : async [Order] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view orders");
    };

    // Users can only view their own orders, admins can view any
    switch (getUserIdFromPrincipal(caller)) {
      case (null) { Runtime.trap("User not found") };
      case (?callerUserId) {
        if (callerUserId != userId and not isUserAdmin(callerUserId)) {
          Runtime.trap("Unauthorized: Can only view your own orders");
        };
        let filteredOrders = orders.values().filter(func(o) { o.salesRepId == userId });
        filteredOrders.toArray();
      };
    };
  };

  public query ({ caller }) func getAllOrders() : async [Order] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all orders");
    };

    orders.values().toArray();
  };

  // STATISTICS
  public query ({ caller }) func getTotalCounts() : async {
    products : Nat;
    customers : Nat;
    orders : Nat;
    users : Nat;
  } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view counts");
    };

    {
      products = products.size();
      customers = customers.size();
      orders = orders.size();
      users = users.size();
    };
  };

  public query ({ caller }) func getAdminStats() : async {
    totalProducts : Nat;
    totalCustomers : Nat;
    totalOrders : Nat;
    totalUsers : Nat;
    pendingOrders : Nat;
    submittedOrders : Nat;
    syncedOrders : Nat;
  } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view admin stats");
    };

    let allOrders = orders.values().toArray();
    let pendingCount = allOrders.filter(func(o) { o.status == "pending" }).size();
    let submittedCount = allOrders.filter(func(o) { o.status == "submitted" }).size();
    let syncedCount = allOrders.filter(func(o) { o.status == "synced" }).size();

    {
      totalProducts = products.size();
      totalCustomers = customers.size();
      totalOrders = orders.size();
      totalUsers = users.size();
      pendingOrders = pendingCount;
      submittedOrders = submittedCount;
      syncedOrders = syncedCount;
    };
  };

  // DATA SEEDING
  public shared ({ caller }) func seedData() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can seed data");
    };

    await createAdminUser("admin-user-id", "admin@example.com", "Admin User");

    let sampleProducts = [
      {
        id = "1";
        sku = "SKU001";
        nameCnSimplified = "红色手机";
        nameCnTraditional = "紅色手機";
        category = "手机";
        price = 499.99;
        stockStatus = "in_stock";
        imageBlob = null;
        createdAt = Time.now();
        updatedAt = Time.now();
      },
      {
        id = "2";
        sku = "SKU002";
        nameCnSimplified = "蓝色手机";
        nameCnTraditional = "藍色手機";
        category = "手机";
        price = 499.99;
        stockStatus = "in_stock";
        imageBlob = null;
        createdAt = Time.now();
        updatedAt = Time.now();
      },
    ];

    for (product in sampleProducts.values()) {
      products.add(product.sku, product);
    };

    let sampleCustomers = [
      {
        id = "1";
        name = "上海贸易公司";
        contactPerson = "李四";
        phone = "13988887777";
        email = "shanghai@trading.com";
        address = "上海市浦东新区102号";
        createdAt = Time.now();
      },
      {
        id = "2";
        name = "北京科技有限公司";
        contactPerson = "王五";
        phone = "13899998888";
        email = "beijing@tech.cn";
        address = "北京市海淀区305号";
        createdAt = Time.now();
      },
    ];

    for (customer in sampleCustomers.values()) {
      customers.add(customer.id, customer);
    };
  };

  // CONTAINER MANAGEMENT
  public shared ({ caller }) func createContainer(
    id : Text,
    containerNo : Text,
    shipper : Text,
    eta : Text,
    entryPort : Text,
    status : Text,
    notes : Text
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can create containers");
    };

    let container : Container = {
      id;
      containerNo;
      shipper;
      eta;
      entryPort;
      status;
      notes;
      createdAt = Time.now();
      updatedAt = Time.now();
    };
    containers.add(id, container);
  };

  public shared ({ caller }) func updateContainer(
    id : Text,
    containerNo : Text,
    shipper : Text,
    eta : Text,
    entryPort : Text,
    status : Text,
    notes : Text
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update containers");
    };

    switch (containers.get(id)) {
      case (null) { Runtime.trap("Container does not exist") };
      case (?existingContainer) {
        let updatedContainer = {
          existingContainer with
          containerNo;
          shipper;
          eta;
          entryPort;
          status;
          notes;
          updatedAt = Time.now();
        };
        containers.add(id, updatedContainer);
      };
    };
  };

  public shared ({ caller }) func deleteContainer(id : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete containers");
    };

    let existed = containers.containsKey(id);
    containers.remove(id);
    if (not existed) {
      Runtime.trap("Container does not exist");
    };
  };

  public query ({ caller }) func getContainer(id : Text) : async ?Container {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view containers");
    };

    containers.get(id);
  };

  public query ({ caller }) func getAllContainers() : async [Container] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view containers");
    };

    containers.values().toArray();
  };

  // CONTAINER ITEM MANAGEMENT
  public shared ({ caller }) func addContainerItem(item : ContainerItem) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can add container items");
    };

    containerItems.add(item.id, item);
  };

  public shared ({ caller }) func removeContainerItem(id : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can remove container items");
    };

    let existed = containerItems.containsKey(id);
    containerItems.remove(id);
    if (not existed) { Runtime.trap("Container item does not exist") };
  };

  public query ({ caller }) func getContainerItems(containerId : Text) : async [ContainerItem] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view container items");
    };

    let filteredItems = containerItems.values().filter(
      func(item) { item.containerId == containerId }
    );
    filteredItems.toArray();
  };

  public shared ({ caller }) func updateContainerItem(item : ContainerItem) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can update container items");
    };

    switch (containerItems.get(item.id)) {
      case (null) { Runtime.trap("Container item does not exist") };
      case (?_) {
        containerItems.add(item.id, item);
      };
    };
  };

  // NEW: Centralized Categories Store
  public shared ({ caller }) func upsertCategory(category : Category) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can upsert categories");
    };
    categories.add(category.catId, category);
  };

  public query ({ caller }) func getAllCategoriesData() : async [Category] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view categories");
    };
    categories.values().toArray();
  };

  public shared ({ caller }) func deleteCategoryData(catId : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete categories");
    };

    switch (categories.get(catId)) {
      case (null) {
        Runtime.trap("Category with id " # catId # " does not exist yet.");
      };
      case (?_) {
        categories.remove(catId);
      };
    };
  };

  // NEW: Extended Product Fields Store
  public shared ({ caller }) func upsertExtendedProduct(ep : ExtendedProduct) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can upsert extended products");
    };
    extendedProducts.add(ep.sku, ep);
  };

  public query ({ caller }) func getAllExtendedProductsData() : async [ExtendedProduct] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view extended products");
    };
    extendedProducts.values().toArray();
  };

  // NEW: App Users Store (for email/password auth)
  public shared ({ caller }) func upsertAppUser(user : AppUser) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can upsert app users");
    };
    appUsers.add(user.email, user);
  };

  public shared ({ caller }) func getAllAppUsers() : async [AppUser] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view all app users");
    };
    appUsers.values().toArray();
  };

  public query ({ caller }) func getAppUserByEmail(email : Text) : async ?AppUser {
    appUsers.get(email);
  };

  public shared ({ caller }) func deleteAppUser(email : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can delete app users");
    };

    switch (appUsers.get(email)) {
      case (null) { Runtime.trap("App user with email " # email # " does not exist yet.") };
      case (?_) { appUsers.remove(email) };
    };
  };

  public shared ({ caller }) func updateAppUserPassword(email : Text, newPassword : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can update passwords");
    };
    switch (appUsers.get(email)) {
      case (null) { Runtime.trap("App user with email " # email # " does not exist") };
      case (?existingUser) {
        let updatedUser = {
          existingUser with
          passwordHash = newPassword;
        };
        appUsers.add(email, updatedUser);
      };
    };
  };
};
