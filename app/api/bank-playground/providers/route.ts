import { NextResponse } from "next/server";
import { BANK_PROVIDER_DESCRIPTORS } from "@/lib/bank-playground/registry";

export async function GET() {
  return NextResponse.json({ providers: BANK_PROVIDER_DESCRIPTORS });
}
