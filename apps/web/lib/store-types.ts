export interface StorePublicConfig {
    is_active: boolean;
    theme: 'dark' | 'light';
    accent_color: string;
    logo_url: string | null;
    store_name: string;
    slogan: string | null;
    custom_domain: string | null;
    hero_image_url: string | null;
    hero_title: string;
    hero_subtitle: string | null;
    hero_cta_label: string;
    wa_number: string | null;
    seo_title: string;
    seo_description: string | null;
}

export interface StorePublicCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    position: number;
}

export interface StorePublicProduct {
    id: string;
    stock_product_id: string | null;
    name: string;
    slug: string;
    description: string | null;
    price_cents: number | null;
    price_from_cents: number | null;
    images: string[];
    cover_image: string | null;
    badge: 'novo' | 'sale' | 'hot' | null;
    is_custom: boolean;
    is_featured: boolean;
    is_available: boolean;
    category: {
        id: string | null;
        name: string;
        slug: string | null;
    } | null;
    stock_quantity: number | null;
    minimum_stock: number | null;
    metal: string | null;
    weight_grams: number | null;
    seo_title: string | null;
    seo_description: string | null;
    whatsapp_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface StoreProductsResponse {
    data: StorePublicProduct[];
    meta: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}

export interface StoreAdminConfig {
    id: string;
    is_active: boolean;
    theme: 'dark' | 'light';
    accent_color: string;
    logo_url: string | null;
    store_name: string | null;
    slogan: string | null;
    custom_domain: string | null;
    hero_image_url: string | null;
    hero_title: string | null;
    hero_subtitle: string | null;
    hero_cta_label: string;
    wa_number: string | null;
    wa_message_tpl: string | null;
    pipeline_id: string | null;
    stage_id: string | null;
    mp_access_token: string | null;
    mp_public_key: string | null;
    checkout_success_url: string | null;
    checkout_failure_url: string | null;
    seo_title: string | null;
    seo_description: string | null;
}

export interface StoreAdminCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    position: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface StoreAdminProduct {
    id: string;
    stock_product_id: string | null;
    stock_product_name: string | null;
    category: {
        id: string;
        name: string;
    } | null;
    name: string;
    slug: string;
    description: string | null;
    price_cents: number | null;
    price_from_cents: number | null;
    images: string[];
    badge: 'novo' | 'sale' | 'hot' | null;
    is_custom: boolean;
    is_published: boolean;
    is_featured: boolean;
    position: number;
    wa_message_tpl: string | null;
    seo_title: string | null;
    seo_description: string | null;
    created_at: string;
    updated_at: string;
}

export interface StoreAdminOrder {
    id: string;
    store_product_id: string;
    product_name: string;
    mp_preference_id: string | null;
    mp_payment_id: string | null;
    customer_id: string | null;
    crm_order_id: string | null;
    crm_payment_id: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    shipping_address: Record<string, unknown> | null;
    amount_cents: number;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface StoreCheckoutPreferenceResponse {
    store_order_id: string;
    preference_id: string;
    payment_url: string;
}
