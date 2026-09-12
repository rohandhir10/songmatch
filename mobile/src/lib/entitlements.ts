import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
} from "react-native-purchases";

// RevenueCat: App Store + Play billing with anonymous app-user IDs, so the
// paywall works with no backend. Products + entitlement ("pro") are
// configured in the RevenueCat dashboard; API keys below come from there.
// Purchases do NOT work in Expo Go — use a dev client / EAS build.
const IOS_KEY = "SET-REVENUECAT-IOS-KEY";
const ANDROID_KEY = "SET-REVENUECAT-ANDROID-KEY";

let configured = false;

export function configurePurchases(): void {
  if (configured) return;
  const key = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;
  if (key.startsWith("SET-")) return; // Keys not added yet: paywall runs dry.
  Purchases.configure({ apiKey: key });
  configured = true;
}

export async function isPro(): Promise<boolean> {
  try {
    configurePurchases();
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return info.entitlements.active["pro"] !== undefined;
  } catch {
    return false;
  }
}

export async function loadOfferings(): Promise<PurchasesOfferings | null> {
  try {
    configurePurchases();
    return await Purchases.getOfferings();
  } catch {
    return null;
  }
}

export async function buyPackage(
  pkg: Parameters<typeof Purchases.purchasePackage>[0]
): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active["pro"] !== undefined;
  } catch {
    return false;
  }
}

export async function restore(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active["pro"] !== undefined;
  } catch {
    return false;
  }
}
