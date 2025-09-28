import type { RouterContext } from "../../types.ts";
import type { ChatState } from "../../state/store.ts";
import { DINE_STATE, dineBackTarget } from "./state.ts";
import {
  managerContextFromState,
  promptAddNumber,
  promptRemoveNumber,
  showBarsEntry,
  showBarsMenu,
  showCurrentNumbers,
  showDeleteMenuConfirmation,
  showEditMenu,
  showManageOrders,
  showManagerEntry,
  showManagerMenu,
  showNumbersMenu,
  showOnboardContacts,
  showOnboardIdentity,
  showOnboardLocation,
  showOnboardPayment,
  showOnboardPublish,
  showOnboardUpload,
  showRemoveCategoriesConfirmation,
  showReviewIntro,
  showReviewItemMenu,
  showReviewList,
  showUploadInstruction,
} from "./manager.ts";
import { startDineIn } from "./browse.ts";

export async function handleDineBack(
  ctx: RouterContext,
  state: ChatState,
): Promise<boolean> {
  const target = dineBackTarget(state);
  if (!target) return false;
  const context = managerContextFromState(state);
  switch (target) {
    case DINE_STATE.ENTRY:
      await showBarsEntry(ctx, context);
      return true;
    case DINE_STATE.MENU:
      await showBarsMenu(ctx, context);
      return true;
    case DINE_STATE.MANAGER_ENTRY:
      await showManagerEntry(ctx, context);
      return true;
    case DINE_STATE.MANAGER_MENU:
      await showManagerMenu(ctx, context);
      return true;
    case DINE_STATE.ONBOARD_IDENTITY:
      await showOnboardIdentity(ctx, context);
      return true;
    case DINE_STATE.ONBOARD_CONTACTS:
      await showOnboardContacts(ctx, context);
      return true;
    case DINE_STATE.ONBOARD_LOCATION:
      await showOnboardLocation(ctx, context);
      return true;
    case DINE_STATE.ONBOARD_PAYMENT:
      await showOnboardPayment(ctx, context);
      return true;
    case DINE_STATE.ONBOARD_UPLOAD:
      if (state.data?.mode === "update") {
        await showUploadInstruction(ctx, context);
      } else {
        await showOnboardUpload(ctx, context);
      }
      return true;
    case DINE_STATE.ONBOARD_PUBLISH:
      await showOnboardPublish(ctx, context);
      return true;
    case DINE_STATE.REVIEW_LIST:
      await showReviewList(
        ctx,
        context,
        {
          page: typeof state.data?.page === "number" ? state.data.page : 1,
        },
      );
      return true;
    case DINE_STATE.REVIEW_ITEM_MENU: {
      const itemId = typeof state.data?.itemId === "string"
        ? state.data.itemId
        : null;
      if (itemId) {
        await showReviewItemMenu(ctx, context, itemId, state);
      } else {
        await showReviewList(ctx, context);
      }
      return true;
    }
    case DINE_STATE.REVIEW_EDIT_FIELD: {
      const itemId = typeof state.data?.itemId === "string"
        ? state.data.itemId
        : null;
      if (itemId) {
        await showReviewItemMenu(ctx, context, itemId, state);
      } else {
        await showReviewList(ctx, context);
      }
      return true;
    }
    case DINE_STATE.MANAGE_ORDERS:
      await showManageOrders(ctx, context, {
        page: typeof state.data?.page === "number" ? state.data.page : 1,
      });
      return true;
    case DINE_STATE.NUMBERS_MENU:
      await showNumbersMenu(ctx, context);
      return true;
    case DINE_STATE.NUMBERS_VIEW:
      await showCurrentNumbers(ctx, context);
      return true;
    case DINE_STATE.NUMBERS_ADD:
      await promptAddNumber(ctx, context);
      return true;
    case DINE_STATE.NUMBERS_REMOVE:
      await promptRemoveNumber(ctx, context);
      return true;
    case DINE_STATE.EDIT_MENU:
      await showEditMenu(ctx, context);
      return true;
    case DINE_STATE.EDIT_CONFIRM_DELETE:
      await showDeleteMenuConfirmation(ctx, context);
      return true;
    case DINE_STATE.EDIT_CONFIRM_REMOVE_CATEGORIES:
      await showRemoveCategoriesConfirmation(ctx, context);
      return true;
    default:
      await startDineIn(ctx, state, { skipResume: true });
      return true;
  }
}
