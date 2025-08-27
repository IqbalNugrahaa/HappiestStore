"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

type Language = "en" | "id";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

// Enhanced translation dictionary
const translations = {
  en: {
    // Navigation
    revenue: "Revenue",
    products: "Products",
    signOut: "Sign Out",
    dashboard: "Dashboard",

    // Dashboard
    revenueManagement: "Revenue Management",
    productManagement: "Product Management",
    welcomeBack: "Welcome back",
    signInToAccount: "Sign in to your revenue management account",
    createAccount: "Create an account",
    signUpToStart: "Sign up to start managing your revenue",

    // Common actions
    add: "Add",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    search: "Search",
    loading: "Loading...",
    submit: "Submit",
    close: "Close",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    previous: "Previous",

    // Products
    productName: "Product Name",
    price: "Price",
    addProduct: "Add Product",
    editProduct: "Edit Product",
    productCatalog: "Product Catalog",
    manageProducts: "Add and manage your products",
    noProducts: "No products yet. Add your first product!",
    noProductsSearch: "No products found matching your search.",
    productCreated: "Product created successfully",
    productUpdated: "Product updated successfully",
    productDeleted: "Product deleted successfully",
    deleteProductConfirm: "Are you sure you want to delete this product?",
    enterProductName: "Enter product name",
    enterPrice: "Enter price",
    created: "Created",
    actions: "Actions",

    // Revenue/Transactions
    transaction: "Transaction",
    transactions: "Transactions",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    totalAmount: "Total Amount",
    transactionDate: "Transaction Date",
    addTransaction: "Add Transaction",
    editTransaction: "Edit Transaction",
    totalRevenue: "Total Revenue",
    thisMonth: "This Month",
    avgTransaction: "Avg Transaction",
    noTransactions: "No transactions yet. Add your first transaction!",
    noTransactionsSearch: "No transactions found matching your search.",
    transactionCreated: "Transaction created successfully",
    transactionUpdated: "Transaction updated successfully",
    transactionDeleted: "Transaction deleted successfully",
    deleteTransactionConfirm:
      "Are you sure you want to delete this transaction?",
    selectProduct: "Select a product",
    customProductName: "Product Name (Custom)",
    enterCustomProduct: "Or enter custom product name",
    allTimeRevenue: "All time revenue",
    averageValue: "Average value",
    fromLastMonth: "from last month",
    trackRevenue: "Track your revenue and transactions",
    today: "Today",
    countTransactions: "Total Transactions",
    totalRevenueToday: "Total Revenue Today",
    revenueToday: "Revenue Today",
    totalRevenueYesterday: "Total Revenue Yesterday",
    revenueYesterday: "Revenue Yesterday",

    // Forms
    email: "Email",
    password: "Password",
    emailPlaceholder: "you@example.com",
    emailRequired: "Email is required",
    passwordRequired: "Password is required",
    signIn: "Sign In",
    signUp: "Sign Up",
    signingIn: "Signing in...",
    signingUp: "Signing up...",
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    logIn: "Log in",
    checkEmail: "Check your email to confirm your account.",

    // Errors and messages
    error: "Error",
    success: "Success",
    unauthorized: "Unauthorized",
    failedToLoad: "Failed to load",
    failedToSave: "Failed to save",
    failedToDelete: "Failed to delete",
    unexpectedError: "An unexpected error occurred. Please try again.",
    formDataMissing: "Form data is missing",
    invalidInput: "Invalid input provided",

    // CSV Upload
    csvUpload: "CSV Upload",
    bulkUpload: "Bulk Upload",
    uploadCsv: "Upload CSV",
    dragDropCsv: "Drag and drop your CSV file here, or click to select",
    csvFormat: "CSV Format",
    csvFormatDesc:
      "Your CSV should have columns: Product Name, Quantity, Unit Price, Transaction Date",
    uploadFile: "Upload File",
    processing: "Processing...",
    uploadSuccess: "File uploaded successfully",
    uploadError: "Failed to upload file",
    invalidFile: "Invalid file format. Please upload a CSV file.",
    fuzzyMatching: "Fuzzy Matching",
    fuzzyMatchingDesc:
      "Automatically match product names with existing products",

    // Stats and analytics
    growth: "Growth",
    positiveGrowth: "+{percent}% from last month",
    negativeGrowth: "{percent}% from last month",
    activeProducts: "Active products",

    // Currency
    currency: "Rp",
    rupiah: "Rupiah",

    // Language
    language: "Language",
    english: "English",
    indonesian: "Bahasa Indonesia",

    // Templates
    downloadTemplate: "Download Template",
    selectFile: "Select File",
    bulkUploadProducts: "Bulk Upload Products",
    productCsvFormat:
      'Upload products via CSV file. Format: "name","type","price"',
    transactionCsvFormat:
      "Date, Item Purchase, Customer Name, Store Name, Payment Method, Purchase, Notes",
  },
  id: {
    // Navigation
    revenue: "Pendapatan",
    products: "Produk",
    signOut: "Keluar",
    dashboard: "Dasbor",

    // Dashboard
    revenueManagement: "Manajemen Pendapatan",
    productManagement: "Manajemen Produk",
    welcomeBack: "Selamat datang kembali",
    signInToAccount: "Masuk ke akun manajemen pendapatan Anda",
    createAccount: "Buat akun",
    signUpToStart: "Daftar untuk mulai mengelola pendapatan Anda",

    // Common actions
    add: "Tambah",
    edit: "Edit",
    delete: "Hapus",
    save: "Simpan",
    cancel: "Batal",
    search: "Cari",
    loading: "Memuat...",
    submit: "Kirim",
    close: "Tutup",
    confirm: "Konfirmasi",
    back: "Kembali",
    next: "Selanjutnya",
    previous: "Sebelumnya",

    // Products
    productName: "Nama Produk",
    price: "Harga",
    addProduct: "Tambah Produk",
    editProduct: "Edit Produk",
    productCatalog: "Katalog Produk",
    manageProducts: "Tambah dan kelola produk Anda",
    noProducts: "Belum ada produk. Tambahkan produk pertama Anda!",
    noProductsSearch: "Tidak ada produk yang ditemukan sesuai pencarian Anda.",
    productCreated: "Produk berhasil dibuat",
    productUpdated: "Produk berhasil diperbarui",
    productDeleted: "Produk berhasil dihapus",
    deleteProductConfirm: "Apakah Anda yakin ingin menghapus produk ini?",
    enterProductName: "Masukkan nama produk",
    enterPrice: "Masukkan harga",
    created: "Dibuat",
    actions: "Aksi",

    // Revenue/Transactions
    transaction: "Transaksi",
    transactions: "Transaksi",
    quantity: "Jumlah",
    unitPrice: "Harga Satuan",
    totalAmount: "Total Harga",
    transactionDate: "Tanggal Transaksi",
    addTransaction: "Tambah Transaksi",
    editTransaction: "Edit Transaksi",
    totalRevenue: "Total Pendapatan",
    thisMonth: "Bulan Ini",
    avgTransaction: "Rata-rata Transaksi",
    noTransactions: "Belum ada transaksi. Tambahkan transaksi pertama Anda!",
    noTransactionsSearch:
      "Tidak ada transaksi yang ditemukan sesuai pencarian Anda.",
    transactionCreated: "Transaksi berhasil dibuat",
    transactionUpdated: "Transaksi berhasil diperbarui",
    transactionDeleted: "Transaksi berhasil dihapus",
    deleteTransactionConfirm:
      "Apakah Anda yakin ingin menghapus transaksi ini?",
    selectProduct: "Pilih produk",
    customProductName: "Nama Produk (Kustom)",
    enterCustomProduct: "Atau masukkan nama produk kustom",
    allTimeRevenue: "Total pendapatan sepanjang masa",
    averageValue: "Nilai rata-rata",
    fromLastMonth: "dari bulan lalu",
    trackRevenue: "Lacak pendapatan dan transaksi Anda",
    today: "Hari Ini",
    countTransactions: "Jumlah Transaksi",
    totalRevenueToday: "Total Pendapatan Hari Ini",
    revenueToday: "Pendapatan Hari Ini",
    totalRevenueYesterday: "Total Pendapatan Kemarin",
    revenueYesterday: "Pendapatan Kemarin",

    // Forms
    email: "Email",
    password: "Kata Sandi",
    emailPlaceholder: "anda@contoh.com",
    emailRequired: "Email diperlukan",
    passwordRequired: "Kata sandi diperlukan",
    signIn: "Masuk",
    signUp: "Daftar",
    signingIn: "Sedang masuk...",
    signingUp: "Sedang mendaftar...",
    dontHaveAccount: "Belum punya akun?",
    alreadyHaveAccount: "Sudah punya akun?",
    logIn: "Masuk",
    checkEmail: "Periksa email Anda untuk mengonfirmasi akun.",

    // Errors and messages
    error: "Kesalahan",
    success: "Berhasil",
    unauthorized: "Tidak diizinkan",
    failedToLoad: "Gagal memuat",
    failedToSave: "Gagal menyimpan",
    failedToDelete: "Gagal menghapus",
    unexpectedError: "Terjadi kesalahan tak terduga. Silakan coba lagi.",
    formDataMissing: "Data formulir hilang",
    invalidInput: "Input tidak valid",

    // CSV Upload
    csvUpload: "Unggah CSV",
    bulkUpload: "Unggah Massal",
    uploadCsv: "Unggah CSV",
    dragDropCsv:
      "Seret dan lepas file CSV Anda di sini, atau klik untuk memilih",
    csvFormat: "Format CSV",
    csvFormatDesc:
      "CSV Anda harus memiliki kolom: Nama Produk, Jumlah, Harga Satuan, Tanggal Transaksi",
    uploadFile: "Unggah File",
    processing: "Memproses...",
    uploadSuccess: "File berhasil diunggah",
    uploadError: "Gagal mengunggah file",
    invalidFile: "Format file tidak valid. Silakan unggah file CSV.",
    fuzzyMatching: "Pencocokan Fuzzy",
    fuzzyMatchingDesc:
      "Otomatis mencocokkan nama produk dengan produk yang ada",

    // Stats and analytics
    growth: "Pertumbuhan",
    positiveGrowth: "+{percent}% dari bulan lalu",
    negativeGrowth: "{percent}% dari bulan lalu",
    activeProducts: "Produk aktif",

    // Currency
    currency: "Rp",
    rupiah: "Rupiah",

    // Language
    language: "Bahasa",
    english: "English",
    indonesian: "Bahasa Indonesia",

    // Templates
    downloadTemplate: "Unduh Template",
    selectFile: "Pilih File",
    bulkUploadProducts: "Unggah Produk Massal",
    productCsvFormat:
      'Unggah produk melalui file CSV. Format: "nama","tipe","harga"',
    transactionCsvFormat:
      "Tanggal, Pembelian Item, Nama Pelanggan, Nama Toko, Metode Pembayaran, Pembelian, Catatan",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const savedLanguage = localStorage.getItem(
      "revenue-app-language"
    ) as Language;
    if (savedLanguage && (savedLanguage === "en" || savedLanguage === "id")) {
      setLanguageState(savedLanguage);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("revenue-app-language", lang);
  };

  const toggleLanguage = () => {
    const newLanguage = language === "en" ? "id" : "en";
    setLanguage(newLanguage);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    let translation =
      translations[language][key as keyof typeof translations.en] || key;

    // Replace parameters in translation
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        translation = translation.replace(`{${paramKey}}`, String(paramValue));
      });
    }

    return translation;
  };

  return (
    <LanguageContext.Provider
      value={{ language, toggleLanguage, setLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
