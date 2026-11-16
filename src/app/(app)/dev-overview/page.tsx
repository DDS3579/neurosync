import { notFound } from "next/navigation";

import DevOverviewClient from "./DevOverviewClient";

export default function DevOverviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DevOverviewClient />;
}
