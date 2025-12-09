/**
 * Groups API Client
 *
 * Provides typed client-side functions for interacting with group-related API endpoints.
 * This module handles join requests and member list fetching with proper error handling
 * and type safety.
 *
 * @module lib/api/groups
 */

/**
 * Member information returned from the members list endpoint
 */
export interface GroupMember {
  /** Unique identifier for the member */
  id: string;
  /** Full name of the member */
  full_name: string;
  /** Mobile phone number */
  msisdn: string;
  /** Unique member code within the group */
  member_code: string;
  /** Current membership status (e.g., 'active', 'pending', 'suspended') */
  status: string;
  /** ISO 8601 timestamp when the member joined the group */
  joined_at: string | null;
}

/**
 * Response structure for the members list API
 */
export interface GroupMembersResponse {
  /** Array of group members */
  members: GroupMember[];
}

/**
 * Request payload for join request submission
 */
export interface JoinRequestPayload {
  /** Optional note to include with the join request (max 280 characters) */
  note?: string;
}

/**
 * Response structure for successful join request
 */
export interface JoinRequestResponse {
  /** Indicates successful request submission */
  ok: boolean;
}

/**
 * Generic error response structure
 */
export interface ApiErrorResponse {
  /** Error message or validation errors */
  error: string | Record<string, unknown>;
}

/**
 * Submits a request to join a specific group
 *
 * This function sends a POST request to the join-request API endpoint.
 * The request is authenticated using the current session cookie.
 *
 * @param groupId - UUID of the group to request joining
 * @param payload - Optional join request payload containing a note
 * @returns Promise resolving to the API response or error
 *
 * @throws {Error} When the request fails or returns a non-ok status
 *
 * @example
 * ```typescript
 * try {
 *   const result = await submitJoinRequest('group-uuid', {
 *     note: 'I would like to join this savings group'
 *   });
 *   console.log('Join request submitted successfully');
 * } catch (error) {
 *   console.error('Failed to submit join request:', error);
 * }
 * ```
 *
 * @accessibility
 * Callers should provide appropriate user feedback for success/error states,
 * including screen reader announcements for status changes.
 */
export async function submitJoinRequest(
  groupId: string,
  payload?: JoinRequestPayload
): Promise<JoinRequestResponse> {
  const response = await fetch(`/api/groups/${groupId}/join-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(
      typeof error.error === "string" ? error.error : "Failed to submit join request"
    );
  }

  return response.json();
}

/**
 * Fetches the list of members for a specific group
 *
 * This function sends a GET request to the members API endpoint.
 * Access is restricted by Row-Level Security (RLS) - only current members
 * of the group can view the members list. Non-members will receive a 403 error.
 *
 * @param groupId - UUID of the group to fetch members for
 * @returns Promise resolving to the members list or error
 *
 * @throws {Error} When the request fails, user is not authenticated, or access is denied
 *
 * @example
 * ```typescript
 * try {
 *   const { members } = await fetchGroupMembers('group-uuid');
 *   console.log(`Found ${members.length} members`);
 * } catch (error) {
 *   console.error('Failed to fetch members:', error);
 *   // Handle 403 case - user is not a member
 * }
 * ```
 *
 * @accessibility
 * Member list results should be presented in an accessible table or list structure
 * with proper ARIA labels and roles. Consider adding sort and filter controls
 * with keyboard navigation support.
 */
export async function fetchGroupMembers(groupId: string): Promise<GroupMembersResponse> {
  const response = await fetch(`/api/groups/${groupId}/members`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));

    // Provide specific error messages based on status code
    if (response.status === 401) {
      throw new Error("You must be logged in to view members");
    }
    if (response.status === 403) {
      throw new Error("Access denied. Only group members can view the members list");
    }

    throw new Error(typeof error.error === "string" ? error.error : "Failed to fetch members");
  }

  return response.json();
}
