import { supabase } from "../../lib/supabase";

export type Profile = {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
};

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}
