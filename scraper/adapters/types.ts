export type StoreConfig = {
  id: string;
  name: string;
  url: string;
  country: string;
  currency?: string;
  platform: 'shopify' | 'woocommerce' | 'prestashop' | 'magento' | 'html' | 'other';
  /** shopify: handle de colección · woocommerce: id de categoría · prestashop/html: URL del listado */
  collection?: string | null;
  /** varias colecciones/categorías si la tienda separa por idioma */
  collections?: string[];
  languages: string[];
  shippingToSpain?: string | null;
  notes?: string;
  enabled?: boolean;
  /** html: selectores CSS para tiendas sin API */
  selectors?: {
    item: string;
    title: string;
    price: string;
    link: string;
    image?: string;
    soldOut?: string;
    /** si el precio está en un atributo (p. ej. "content", "data-price") */
    priceAttr?: string;
    /** si el título completo está en un atributo (p. ej. "title") */
    titleAttr?: string;
    /** texto extra para el clasificador (bandera de idioma, etiqueta de tipo…) */
    meta?: string;
    next?: string;
  };
  /** milisegundos entre peticiones a esta tienda (si se satura con el ritmo normal) */
  delayMs?: number;
  /** html: paginar con ?<pageParam>=N en vez de seguir el enlace "siguiente" */
  pageParam?: string;
  maxPages?: number;
};

export type RawOffer = {
  externalId: string;
  title: string;
  variant?: string;
  meta?: string;
  url: string;
  image?: string | null;
  price: number | null;
  currency: string;
  available: boolean | null;
};

export type Adapter = (store: StoreConfig, log: (msg: string) => void) => Promise<RawOffer[]>;
