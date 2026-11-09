import { apiClient } from "../../api/client";
import type { CalendarEventsResponse } from "../../types/calendar";

export interface AddHolidayPayload {
  name: string;
  date: string;
}

export interface UpdateHolidayPayload {
  name?: string;
  date?: string;
}

export const calendarApi = {
  /**
   * Fetches unified events in visible date range with optional type filters.
   */
  async getEvents(start: string, end: string, types?: string): Promise<CalendarEventsResponse> {
    const params: Record<string, string> = { start, end };
    if (types) {
      params.types = types;
    }

    const response = await apiClient.get<CalendarEventsResponse>("/calendar/events", {
      params,
    });
    return response.data;
  },

  /**
   * Admin: Adds a new company holiday.
   */
  async addHoliday(payload: AddHolidayPayload) {
    const response = await apiClient.post("/leaves/holidays", payload);
    return response.data;
  },

  /**
   * Admin: Updates an existing company holiday.
   */
  async updateHoliday(id: string, payload: UpdateHolidayPayload) {
    const response = await apiClient.put(`/leaves/holidays/${id}`, payload);
    return response.data;
  },

  /**
   * Admin: Deletes a company holiday.
   */
  async deleteHoliday(id: string) {
    const response = await apiClient.delete(`/leaves/holidays/${id}`);
    return response.data;
  },
};
