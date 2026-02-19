import {
  BankProviderId,
  PlaygroundConnector,
  ProviderDescriptor,
} from "@/lib/bank-playground/types";
import { trading212Connector } from "@/lib/bank-playground/connectors/trading212";
import { interactiveBrokersConnector } from "@/lib/bank-playground/connectors/interactiveBrokers";
import { revolutConnector } from "@/lib/bank-playground/connectors/revolut";
import { tradeRepublicConnector } from "@/lib/bank-playground/connectors/tradeRepublic";

const CONNECTORS = {
  trading212: trading212Connector,
  interactive_brokers: interactiveBrokersConnector,
  revolut: revolutConnector,
  trade_republic: tradeRepublicConnector,
} as const satisfies Record<BankProviderId, PlaygroundConnector>;

export const BANK_PROVIDER_DESCRIPTORS: ProviderDescriptor[] = Object.values(
  CONNECTORS
).map((connector) => connector.descriptor);

export function isBankProviderId(value: string): value is BankProviderId {
  return value in CONNECTORS;
}

export function getBankConnector(
  providerId: BankProviderId
): PlaygroundConnector {
  return CONNECTORS[providerId];
}
