import { notFound } from "next/navigation";

import DevBrainClient from "./DevBrainClient";

export default function DevBrainPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DevBrainClient />;
}
