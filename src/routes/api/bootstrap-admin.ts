import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/bootstrap-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-bootstrap-secret");
        if (secret !== "belisoft-bootstrap-2026") {
          return new Response("Forbidden", { status: 403 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const email = "admin@belisoft.ch";
        const password = "Admin2026!Balkan";

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createErr && !String(createErr.message).toLowerCase().includes("already")) {
          return new Response(JSON.stringify({ error: createErr.message }), { status: 500 });
        }

        let userId = created?.user?.id;
        if (!userId) {
          const { data: list } = await supabaseAdmin.auth.admin.listUsers();
          userId = list.users.find((u) => u.email === email)?.id;
        }
        if (!userId) return new Response("no user id", { status: 500 });

        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });
        if (roleErr && !String(roleErr.message).toLowerCase().includes("duplicate")) {
          return new Response(JSON.stringify({ error: roleErr.message }), { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true, email, password, userId }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
