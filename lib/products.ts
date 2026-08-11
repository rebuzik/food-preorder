export type Supplier = string;

export type Product = {
  id: string;
  name: string;
  supplier: Supplier;
  supplierId?: string | null;
  supplierCatalogEnabled?: boolean;
  category: string;
  description: string;
  weight: string;
  price: number;
  image: string;
  images?: string[];
  externalKey?: string | null;
  article?: string | null;
  barcode?: string | null;
  available: boolean;
};

export type SupplierSummary = {
  id: string;
  name: string;
  normalizedName: string;
  catalogEnabled: boolean;
  productCount: number;
  activeProductCount: number;
};

export const defaultProducts: Product[] = [
  {
    id: "partik-creamy-chicken",
    name: "Курица в сливочном соусе",
    supplier: "Партик",
    category: "Горячее",
    description: "С картофельным пюре и зелёной фасолью",
    weight: "320 г",
    price: 42000,
    image: "/images/partik-creamy-chicken.webp",
    available: true,
  },
  {
    id: "partik-cabbage-rolls",
    name: "Голубцы с индейкой",
    supplier: "Партик",
    category: "Горячее",
    description: "В томатном соусе с пряными травами",
    weight: "300 г",
    price: 39000,
    image: "/images/partik-cabbage-rolls.webp",
    available: true,
  },
  {
    id: "partik-salmon",
    name: "Лосось терияки",
    supplier: "Партик",
    category: "Горячее",
    description: "С рисом, брокколи и зелёными бобами",
    weight: "290 г",
    price: 59000,
    image: "/images/partik-salmon.webp",
    available: true,
  },
  {
    id: "lab-syrniki",
    name: "Сырники с ягодами",
    supplier: "Лаборатория еды",
    category: "Завтраки",
    description: "Нежные сырники, сметана и свежие ягоды",
    weight: "240 г",
    price: 35000,
    image: "/images/lab-syrniki.webp",
    available: true,
  },
  {
    id: "lab-pumpkin-soup",
    name: "Тыквенный крем-суп",
    supplier: "Лаборатория еды",
    category: "Супы",
    description: "С тыквенными семечками и хрустящим тостом",
    weight: "300 мл",
    price: 29000,
    image: "/images/lab-pumpkin-soup.webp",
    available: false,
  },
  {
    id: "lab-chicken-bowl",
    name: "Боул с курицей и киноа",
    supplier: "Лаборатория еды",
    category: "Боулы",
    description: "С авокадо, бататом и свежей зеленью",
    weight: "340 г",
    price: 46000,
    image: "/images/lab-chicken-bowl.webp",
    available: true,
  },
];

export function formatPrice(kopecks: number) {
  return `${new Intl.NumberFormat("ru-RU").format(kopecks / 100)} ₽`;
}
