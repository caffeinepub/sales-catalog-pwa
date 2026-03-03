import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import Text "mo:core/Text";
import Float "mo:core/Float";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Array "mo:core/Array";

actor {
  // Types
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
    imageUrl : Text;
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

  module Product {
    public func compare(a : Product, b : Product) : Order.Order {
      Text.compare(a.id, b.id);
    };

    public func compareBySku(a : Product, b : Product) : Order.Order {
      Text.compare(a.sku, b.sku);
    };
  };

  let users = Map.empty<Text, UserProfile>();
  let products = Map.empty<Text, Product>();
  let customers = Map.empty<Text, Customer>();
  let orders = Map.empty<Text, Order>();
  let orderItems = Map.empty<Text, OrderItem>();

  // User Profile Management
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

  // Product Management
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
          imageUrl = product.imageUrl;
          updatedAt = Time.now();
        };
        products.add(product.sku, updatedProduct);
      };
    };
  };

  public query ({ caller }) func getProductsBySku(sku : Text) : async Product {
    switch (products.get(sku)) {
      case (null) { Runtime.trap("Product does not exist") };
      case (?product) { product };
    };
  };

  // Order Management
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

  // Statistics
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

  // Admin stats
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

  // Data Seeding
  public shared ({ caller }) func seedData() : async () {
    // Seed admin user
    await createAdminUser("admin-user-id", "admin@example.com", "Admin User");

    // Seed products
    let sampleProducts = [
      {
        id = "1";
        sku = "SKU001";
        nameCnSimplified = "红色手机";
        nameCnTraditional = "紅色手機";
        category = "手机";
        price = 499.99;
        stockStatus = "in_stock";
        imageUrl = "https://example.com/images/phone_red.png";
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
        imageUrl = "https://example.com/images/phone_blue.png";
        createdAt = Time.now();
        updatedAt = Time.now();
      },
    ];

    for (product in sampleProducts.values()) {
      products.add(product.sku, product);
    };

    // Seed customers
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
};
