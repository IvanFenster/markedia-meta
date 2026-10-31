import { redirect } from "next/navigation";

// Sell page has been replaced by the Ideas Lab.
// Permanently redirect any old links / bookmarks.
export default function SellPage() {
  redirect("/lab");
}
