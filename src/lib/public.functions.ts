import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadSiteContent, loadSeoSettings, type SeoRow } from "./site.server";

export type { SeoRow };

export type ContactInfo = {
  restaurant_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  instagram_url: string;
  facebook_url: string;
  maps_embed_url: string;
  hours_public_visible: boolean;
};

export type OpeningHour = {
  weekday: number;
  label: string;
  is_closed: boolean;
  open_time: string;
  close_time: string;
  note: string;
};

export const getPublicData = createServerFn({ method: "GET" }).handler(async () => {
  const [content, contactRes, hoursRes] = await Promise.all([
    loadSiteContent(),
    supabaseAdmin.from("contact_info").select("*").eq("id", 1).single(),
    supabaseAdmin.from("opening_hours").select("*").order("weekday"),
  ]);
  const contact = (contactRes.data ?? {
    restaurant_name: "Balkaneros",
    address_line1: "",
    address_line2: "",
    city: "",
    postal_code: "",
    phone: "",
    email: "",
    instagram_url: "",
    facebook_url: "",
    maps_embed_url: "",
    hours_public_visible: true,
  }) as ContactInfo;
  const hours = (hoursRes.data ?? []) as OpeningHour[];
  // Order so Monday comes first
  const order = [1, 2, 3, 4, 5, 6, 0];
  hours.sort((a, b) => order.indexOf(a.weekday) - order.indexOf(b.weekday));
  return { content, contact, hours };
});
