import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

async function main() {
  const startOfDay = Math.floor(new Date("2025-12-26T00:00:00Z").getTime() / 1000);
  const endOfDay = Math.floor(new Date("2025-12-27T00:00:00Z").getTime() / 1000);

  console.log("Subscriptions created Dec 26, 2024:\n");

  const subs = await stripe.subscriptions.list({
    created: { gte: startOfDay, lt: endOfDay },
    limit: 100,
    expand: ["data.customer"]
  });

  console.log("Total: " + subs.data.length + "\n");

  for (const sub of subs.data) {
    const customer = sub.customer as Stripe.Customer;
    const price = sub.items.data[0]?.price;
    const amount = (price?.unit_amount || 0) / 100;
    const currency = price?.currency?.toUpperCase() || "";
    const interval = price?.recurring?.interval || "";

    console.log("Email: " + customer.email);
    console.log("Name: " + (customer.name || "N/A"));
    console.log("Created: " + new Date(sub.created * 1000).toISOString());
    console.log("Status: " + sub.status);
    console.log("Plan: " + amount + " " + currency + "/" + interval);
    if (sub.trial_end) {
      console.log("Trial ends: " + new Date(sub.trial_end * 1000).toISOString());
    }
    console.log("");
  }

  console.log("---\nCheckout sessions Dec 26:\n");

  const sessions = await stripe.checkout.sessions.list({
    created: { gte: startOfDay, lt: endOfDay },
    limit: 100
  });

  const completed = sessions.data.filter(s => s.status === "complete");
  console.log("Completed: " + completed.length + "\n");

  for (const s of completed) {
    console.log("Email: " + (s.customer_email || "N/A"));
    console.log("Amount: " + ((s.amount_total || 0) / 100) + " " + (s.currency?.toUpperCase() || ""));
    console.log("Mode: " + s.mode);
    console.log("");
  }
}

main().catch(console.error);
