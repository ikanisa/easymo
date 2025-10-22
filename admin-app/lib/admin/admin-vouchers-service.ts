import { shouldUseMocks } from "@/lib/runtime-config";
import {
  type AdminVoucherDetail,
  adminVoucherDetailSchema,
  type AdminVoucherList,
  adminVoucherListSchema,
} from "@/lib/schemas";
import { mockAdminVoucherDetail, mockAdminVoucherList } from "@/lib/mock-data";
import { getAdminApiPath } from "@/lib/routes";

const useMocks = shouldUseMocks();

export async function getAdminVoucherRecent(): Promise<AdminVoucherList> {
  if (useMocks) {
    return mockAdminVoucherList;
  }

  try {
    const response = await fetch(getAdminApiPath("admin", "vouchers", "recent"), {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        `Admin voucher recent request failed with ${response.status}`,
      );
    }
    const json = await response.json();
    return adminVoucherListSchema.parse(json);
  } catch (error) {
    console.error("Admin voucher recent fetch failed", error);
    return adminVoucherListSchema.parse({
      vouchers: mockAdminVoucherList.vouchers,
      messages: [
        ...mockAdminVoucherList.messages,
        "Failed to load live vouchers. Showing mock list instead.",
      ],
    });
  }
}

export async function getAdminVoucherDetail(
  voucherId: string,
): Promise<AdminVoucherDetail> {
  if (useMocks) {
    return mockAdminVoucherDetail;
  }

  try {
    const response = await fetch(getAdminApiPath("admin", "vouchers", voucherId), {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        `Admin voucher detail request failed with ${response.status}`,
      );
    }
    const json = await response.json();
    return adminVoucherDetailSchema.parse(json);
  } catch (error) {
    console.error("Admin voucher detail fetch failed", error);
    return adminVoucherDetailSchema.parse({
      ...mockAdminVoucherDetail,
      messages: [
        ...mockAdminVoucherDetail.messages,
        "Failed to load voucher detail. Showing mock data instead.",
      ],
    });
  }
}
