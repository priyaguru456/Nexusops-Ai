import { api } from "../../api/client";
import type {
  Survey,
  SurveyResults,
  PendingCsatResponse,
  SurveyResponseAnswers,
  SurveyQuestion,
} from "../../types/surveys";
import type { Role } from "../../types/auth";

export const surveysApi = {
  getPendingCsat: async (): Promise<PendingCsatResponse> => {
    const res = await api.get<PendingCsatResponse>("/surveys/pending-csat");
    return res.data;
  },

  submitResponse: async (payload: {
    surveyId: string;
    entityType?: string;
    entityId: string;
    answers: SurveyResponseAnswers;
  }): Promise<{ message: string }> => {
    const res = await api.post<{ message: string }>("/surveys/responses", {
      surveyId: payload.surveyId,
      entityType: payload.entityType || "REQUEST",
      entityId: payload.entityId,
      answers: payload.answers,
    });
    return res.data;
  },

  getSurveys: async (): Promise<Survey[]> => {
    const res = await api.get<{ surveys: Survey[] }>("/surveys");
    return res.data.surveys;
  },

  createSurvey: async (payload: {
    title: string;
    targetRole?: Role | null;
    isActive?: boolean;
    questions: SurveyQuestion[];
  }): Promise<Survey> => {
    const res = await api.post<{ survey: Survey }>("/surveys", payload);
    return res.data.survey;
  },

  updateSurvey: async (
    id: string,
    payload: {
      title?: string;
      targetRole?: Role | null;
      isActive?: boolean;
      questions?: SurveyQuestion[];
    }
  ): Promise<Survey> => {
    const res = await api.put<{ survey: Survey }>(`/surveys/${id}`, payload);
    return res.data.survey;
  },

  toggleSurveyActive: async (id: string): Promise<Survey> => {
    const res = await api.patch<{ survey: Survey }>(`/surveys/${id}/toggle-active`);
    return res.data.survey;
  },

  getResults: async (params?: {
    surveyId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<SurveyResults> => {
    const res = await api.get<{ results: SurveyResults }>("/surveys/results", { params });
    return res.data.results;
  },
};
