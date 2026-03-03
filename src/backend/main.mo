import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Order "mo:core/Order";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import Storage "blob-storage/Storage";
import MixinStorage "blob-storage/Mixin";



actor {
  // TYPES

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

  type UserRole = {
    #admin;
    #salesRep;
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

  // DATA STORES
  let users = Map.empty<Text, UserProfile>();
  let products = Map.empty<Text, Product>();
  let customers = Map.empty<Text, Customer>();
  let orders = Map.empty<Text, Order>();
  let orderItems = Map.empty<Text, OrderItem>();
  let containers = Map.empty<Text, Container>();
  let containerItems = Map.empty<Text, ContainerItem>();

  include MixinStorage();

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
    switch (products.get(sku)) {
      case (null) { Runtime.trap("Product does not exist") };
      case (?product) { product.imageBlob };
    };
  };

  public query ({ caller }) func getProductBySku(sku : Text) : async Product {
    switch (products.get(sku)) {
      case (null) { Runtime.trap("Product does not exist") };
      case (?product) { product };
    };
  };

  public shared ({ caller }) func upsertProductBySku(product : Product) : async () {
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

  // USER PROFILE MANAGEMENT
  public shared ({ caller }) func inviteUser(id : Text, email : Text, fullName : Text, invitedBy : ?Text) : async () {
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
    switch (users.get(userId)) {
      case (null) { Runtime.trap("User does not exist") };
      case (?userProfile) { userProfile.role };
    };
  };

  public shared ({ caller }) func incrementUserOrderCount(userId : Text) : async () {
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

  // ORDER MANAGEMENT
  public shared ({ caller }) func submitOrder(order : Order, items : [OrderItem]) : async () {
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
    let filteredOrders = orders.values().filter(func(o) { o.salesRepId == userId });
    filteredOrders.toArray();
  };

  public query ({ caller }) func getAllOrders() : async [Order] {
    orders.values().toArray();
  };

  // STATISTICS
  public query ({ caller }) func getTotalCounts() : async {
    products : Nat;
    customers : Nat;
    orders : Nat;
    users : Nat;
  } {
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

  // CONTAINER MANAGEMENT - NEW

  public shared ({ caller }) func createContainer(
    id : Text,
    containerNo : Text,
    shipper : Text,
    eta : Text,
    entryPort : Text,
    status : Text,
    notes : Text
  ) : async () {
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
    let existed = containers.containsKey(id);
    containers.remove(id);
    if (not existed) {
      Runtime.trap("Container does not exist");
    };
  };

  public query ({ caller }) func getContainer(id : Text) : async ?Container {
    containers.get(id);
  };

  public query ({ caller }) func getAllContainers() : async [Container] {
    containers.values().toArray();
  };

  // CONTAINER ITEM MANAGEMENT - NEW
  public shared ({ caller }) func addContainerItem(item : ContainerItem) : async () {
    containerItems.add(item.id, item);
  };

  public shared ({ caller }) func removeContainerItem(id : Text) : async () {
    let existed = containerItems.containsKey(id);
    containerItems.remove(id);
    if (not existed) { Runtime.trap("Container item does not exist") };
  };

  public query ({ caller }) func getContainerItems(containerId : Text) : async [ContainerItem] {
    let filteredItems = containerItems.values().filter(
      func(item) { item.containerId == containerId }
    );
    filteredItems.toArray();
  };

  public shared ({ caller }) func updateContainerItem(item : ContainerItem) : async () {
    switch (containerItems.get(item.id)) {
      case (null) { Runtime.trap("Container item does not exist") };
      case (?_) {
        containerItems.add(item.id, item);
      };
    };
  };
};
