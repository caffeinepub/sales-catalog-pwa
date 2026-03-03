// All UI text in Traditional Chinese and English

export type Language = "traditional" | "english";

export const translations = {
  // App
  appName: {
    traditional: "銷售目錄",
    english: "Sales Catalog",
  },

  // Navigation
  catalog: {
    traditional: "目錄",
    english: "Catalog",
  },
  myOrders: {
    traditional: "我的訂單",
    english: "My Orders",
  },
  admin: {
    traditional: "管理",
    english: "Admin",
  },

  // Auth
  login: {
    traditional: "登錄",
    english: "Login",
  },
  logout: {
    traditional: "退出登錄",
    english: "Logout",
  },
  email: {
    traditional: "郵箱",
    english: "Email",
  },
  password: {
    traditional: "密碼",
    english: "Password",
  },
  loginButton: {
    traditional: "登錄",
    english: "Login",
  },
  loginError: {
    traditional: "郵箱或密碼錯誤",
    english: "Incorrect email or password",
  },
  loggingIn: {
    traditional: "登錄中...",
    english: "Logging in...",
  },
  welcomeBack: {
    traditional: "歡迎回來",
    english: "Welcome back",
  },
  salesCatalogSystem: {
    traditional: "銷售目錄管理系統",
    english: "Sales Catalog Management System",
  },

  // Catalog
  searchPlaceholder: {
    traditional: "搜尋產品編號或名稱...",
    english: "Search by SKU or product name...",
  },
  allCategories: {
    traditional: "全部",
    english: "All",
  },
  orderingFor: {
    traditional: "正在為",
    english: "Ordering for",
  },
  orderingForSuffix: {
    traditional: "下單",
    english: "",
  },
  selectCustomer: {
    traditional: "選擇客戶",
    english: "Select Customer",
  },
  selectCustomerDesc: {
    traditional: "請選擇一個客戶以開始下單",
    english: "Please select a customer to start ordering",
  },
  searchCustomer: {
    traditional: "搜尋客戶名稱或聯繫人...",
    english: "Search customer name or contact...",
  },
  noCustomersFound: {
    traditional: "未找到匹配的客戶",
    english: "No matching customers found",
  },
  confirm: {
    traditional: "確認",
    english: "Confirm",
  },
  changeCustomer: {
    traditional: "更換客戶",
    english: "Change Customer",
  },

  // Product
  inStock: {
    traditional: "有貨",
    english: "In Stock",
  },
  lowStock: {
    traditional: "庫存少",
    english: "Low Stock",
  },
  outOfStock: {
    traditional: "缺貨",
    english: "Out of Stock",
  },
  addToCart: {
    traditional: "加入購物車",
    english: "Add to Cart",
  },

  // Cart
  cart: {
    traditional: "購物車",
    english: "Cart",
  },
  cartEmpty: {
    traditional: "購物車是空的",
    english: "Your cart is empty",
  },
  cartEmptyDesc: {
    traditional: "請返回目錄頁添加商品",
    english: "Return to the catalog to add items",
  },
  orderSummary: {
    traditional: "訂單摘要",
    english: "Order Summary",
  },
  customer: {
    traditional: "客戶",
    english: "Customer",
  },
  salesRep: {
    traditional: "業務員",
    english: "Sales Rep",
  },
  orderDate: {
    traditional: "日期",
    english: "Date",
  },
  sku: {
    traditional: "編號",
    english: "SKU",
  },
  productName: {
    traditional: "產品名稱",
    english: "Product Name",
  },
  quantity: {
    traditional: "數量",
    english: "Qty",
  },
  unitPrice: {
    traditional: "單價",
    english: "Unit Price",
  },
  subtotal: {
    traditional: "小計",
    english: "Subtotal",
  },
  grandTotal: {
    traditional: "總計",
    english: "Total",
  },
  submitOrder: {
    traditional: "提交訂單",
    english: "Submit Order",
  },
  submittingOrder: {
    traditional: "提交中...",
    english: "Submitting...",
  },
  backToCatalog: {
    traditional: "返回目錄",
    english: "Back to Catalog",
  },

  // Orders
  ordersTitle: {
    traditional: "我的訂單",
    english: "My Orders",
  },
  syncNow: {
    traditional: "立即同步",
    english: "Sync Now",
  },
  syncing: {
    traditional: "同步中...",
    english: "Syncing...",
  },
  noOrders: {
    traditional: "暫無訂單",
    english: "No Orders",
  },
  noOrdersDesc: {
    traditional: "您還沒有提交任何訂單",
    english: "You haven't submitted any orders yet",
  },
  pendingStatus: {
    traditional: "待同步",
    english: "Pending Sync",
  },
  syncedStatus: {
    traditional: "已同步",
    english: "Synced",
  },
  submittedStatus: {
    traditional: "已提交",
    english: "Submitted",
  },
  items: {
    traditional: "件商品",
    english: "items",
  },
  viewDetails: {
    traditional: "查看詳情",
    english: "View Details",
  },
  orderDetails: {
    traditional: "訂單詳情",
    english: "Order Details",
  },
  close: {
    traditional: "關閉",
    english: "Close",
  },
  orderStatus: {
    traditional: "狀態",
    english: "Status",
  },

  // Success Modal
  orderSubmitted: {
    traditional: "訂單已提交！",
    english: "Order Submitted!",
  },
  orderSavedOffline: {
    traditional: "已離線保存！",
    english: "Saved Offline!",
  },
  orderSubmittedDesc: {
    traditional: "Excel文件已下載，訂單已發送至辦公室。",
    english: "Excel file downloaded and order sent to the office.",
  },
  orderSavedOfflineDesc: {
    traditional: "聯網後將自動同步到服務器。",
    english: "Will auto-sync to server when back online.",
  },
  continueShopping: {
    traditional: "繼續購物",
    english: "Continue Shopping",
  },

  // Admin
  adminDashboard: {
    traditional: "管理後台",
    english: "Admin Dashboard",
  },
  totalProducts: {
    traditional: "產品總數",
    english: "Total Products",
  },
  totalCustomers: {
    traditional: "客戶總數",
    english: "Total Customers",
  },
  totalOrders: {
    traditional: "訂單總數",
    english: "Total Orders",
  },
  totalUsers: {
    traditional: "用戶總數",
    english: "Total Users",
  },
  productManagement: {
    traditional: "產品管理",
    english: "Product Management",
  },
  userManagement: {
    traditional: "用戶管理",
    english: "User Management",
  },
  customerManagement: {
    traditional: "客戶管理",
    english: "Customer Management",
  },
  addProduct: {
    traditional: "添加產品",
    english: "Add Product",
  },
  bulkUpload: {
    traditional: "批量導入",
    english: "Bulk Import",
  },
  editProduct: {
    traditional: "編輯產品",
    english: "Edit Product",
  },
  deleteProduct: {
    traditional: "刪除產品",
    english: "Delete Product",
  },
  inviteSalesRep: {
    traditional: "邀請業務員",
    english: "Invite Sales Rep",
  },
  addAdmin: {
    traditional: "添加管理員",
    english: "Add Admin",
  },
  addCustomer: {
    traditional: "添加客戶",
    english: "Add Customer",
  },
  editCustomer: {
    traditional: "編輯客戶",
    english: "Edit Customer",
  },
  deleteCustomer: {
    traditional: "刪除客戶",
    english: "Delete Customer",
  },
  save: {
    traditional: "保存",
    english: "Save",
  },
  saving: {
    traditional: "保存中...",
    english: "Saving...",
  },
  cancel: {
    traditional: "取消",
    english: "Cancel",
  },
  delete: {
    traditional: "刪除",
    english: "Delete",
  },
  edit: {
    traditional: "編輯",
    english: "Edit",
  },
  actions: {
    traditional: "操作",
    english: "Actions",
  },
  name: {
    traditional: "名稱",
    english: "Name",
  },
  contactPerson: {
    traditional: "聯繫人",
    english: "Contact Person",
  },
  phone: {
    traditional: "電話",
    english: "Phone",
  },
  address: {
    traditional: "地址",
    english: "Address",
  },
  role: {
    traditional: "角色",
    english: "Role",
  },
  joinDate: {
    traditional: "加入日期",
    english: "Join Date",
  },
  totalOrdersUser: {
    traditional: "總訂單數",
    english: "Total Orders",
  },
  adminRole: {
    traditional: "管理員",
    english: "Admin",
  },
  salesRepRole: {
    traditional: "業務員",
    english: "Sales Rep",
  },
  fullName: {
    traditional: "姓名",
    english: "Full Name",
  },
  category: {
    traditional: "分類",
    english: "Category",
  },
  price: {
    traditional: "價格",
    english: "Price",
  },
  stockStatus: {
    traditional: "庫存狀態",
    english: "Stock Status",
  },
  imageUrl: {
    traditional: "圖片連結",
    english: "Image URL",
  },

  // Online/Offline
  online: {
    traditional: "在線",
    english: "Online",
  },
  offline: {
    traditional: "離線",
    english: "Offline",
  },

  // Errors
  loadError: {
    traditional: "加載失敗，請重試",
    english: "Failed to load, please try again",
  },
  submitError: {
    traditional: "提交失敗，已保存至本地",
    english: "Submission failed, saved locally",
  },

  // Upload
  uploadExcel: {
    traditional: "上傳Excel文件",
    english: "Upload Excel File",
  },
  downloadTemplate: {
    traditional: "下載模板",
    english: "Download Template",
  },
  uploadResults: {
    traditional: "上傳結果",
    english: "Upload Results",
  },
  created: {
    traditional: "已創建",
    english: "Created",
  },
  updated: {
    traditional: "已更新",
    english: "Updated",
  },
  errors: {
    traditional: "錯誤",
    english: "Errors",
  },
  processing: {
    traditional: "處理中...",
    english: "Processing...",
  },
  nameCnTraditional: {
    traditional: "繁體中文名稱",
    english: "Traditional Chinese Name",
  },
  categoryId: {
    traditional: "分類編號",
    english: "Category ID",
  },
  brand: {
    traditional: "品牌",
    english: "Brand",
  },
  nameEn: {
    traditional: "英文名稱",
    english: "English Name",
  },
  size: {
    traditional: "規格",
    english: "Size",
  },
  bbd: {
    traditional: "最佳食用期",
    english: "BBD",
  },
  vat: {
    traditional: "增值稅",
    english: "VAT",
  },
  uom: {
    traditional: "計量單位",
    english: "UoM",
  },
  stock: {
    traditional: "庫存數量",
    english: "Stock",
  },
  promotions: {
    traditional: "促銷信息",
    english: "Promotions",
  },
  categoryManagement: {
    traditional: "分類管理",
    english: "Category Management",
  },
  addCategory: {
    traditional: "添加分類",
    english: "Add Category",
  },
  editCategory: {
    traditional: "編輯分類",
    english: "Edit Category",
  },
  deleteCategory: {
    traditional: "刪除分類",
    english: "Delete Category",
  },
  catId: {
    traditional: "分類編號",
    english: "Cat ID",
  },
  catEn: {
    traditional: "英文名稱",
    english: "Cat Name (EN)",
  },
  catCn: {
    traditional: "中文名稱",
    english: "Cat Name (繁體)",
  },
  subCat: {
    traditional: "子分類",
    english: "Sub-Category",
  },

  // Misc
  noData: {
    traditional: "暫無數據",
    english: "No data available",
  },
  loading: {
    traditional: "加載中...",
    english: "Loading...",
  },
  retry: {
    traditional: "重試",
    english: "Retry",
  },
  pendingOrders: {
    traditional: "待同步訂單",
    english: "Pending Sync Orders",
  },
  syncSuccess: {
    traditional: "同步成功",
    english: "Sync successful",
  },
  syncError: {
    traditional: "同步失敗",
    english: "Sync failed",
  },

  // Image upload
  uploadImage: {
    traditional: "上傳圖片",
    english: "Upload Image",
  },
  selectImage: {
    traditional: "選擇圖片",
    english: "Select Image",
  },
  uploadingImage: {
    traditional: "上傳中...",
    english: "Uploading image...",
  },
  imageUploaded: {
    traditional: "圖片已上傳",
    english: "Image uploaded",
  },
  imageUploadError: {
    traditional: "圖片上傳失敗",
    english: "Image upload failed",
  },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Language): string {
  const entry = translations[key];
  return entry[lang];
}
