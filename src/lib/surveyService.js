import { supabase } from "./supabaseClient";

const CLOSED_STATUS = "closed";
const ACTIVE_STATUS = "active";

const normalizeSurveyCode = (surveyCode = "") => surveyCode.trim().toUpperCase();

const mapQuestion = (question) => ({
  id: question.id,
  type: question.question_type,
  content: question.content,
  options: Array.isArray(question.options) ? question.options : [],
  position: question.position ?? 0,
});

const isSurveyClosed = (survey) => {
  if (!survey) {
    return false;
  }

  if (survey.status === CLOSED_STATUS) {
    return true;
  }

  if (survey.status !== ACTIVE_STATUS) {
    return true;
  }

  if (!survey.closed_at) {
    return false;
  }

  return new Date(survey.closed_at).getTime() <= Date.now();
};

export const fetchSurveyByCode = async (surveyCode) => {
  const normalizedCode = normalizeSurveyCode(surveyCode);

  if (!normalizedCode) {
    return { status: "invalid_code" };
  }

  const { data, error } = await supabase
    .from("surveys")
    .select(`
      id,
      title,
      status,
      unique_code,
      closed_at,
      questions (
        id,
        question_type,
        content,
        options,
        position
      )
    `)
    .eq("unique_code", normalizedCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return { status: "invalid_code" };
  }

  if (isSurveyClosed(data)) {
    return {
      status: "survey_closed",
      survey: {
        id: data.id,
        title: data.title,
        code: data.unique_code,
      },
    };
  }

  const questions = Array.isArray(data.questions)
    ? [...data.questions]
        .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
        .map(mapQuestion)
    : [];

  if (questions.length === 0) {
    return {
      status: "empty",
      survey: {
        id: data.id,
        title: data.title,
        code: data.unique_code,
        questions,
      },
    };
  }

  return {
    status: "ready",
    survey: {
      id: data.id,
      title: data.title,
      code: data.unique_code,
      questions,
    },
  };
};

export const submitSurveyResponse = async ({ surveyId, answers }) => {
  const { data: response, error: responseError } = await supabase
    .from("responses")
    .insert({ survey_id: surveyId })
    .select("id")
    .single();

  if (responseError) {
    throw responseError;
  }

  const rows = answers.map((answer) => ({
    response_id: response.id,
    question_id: answer.questionId,
    answer_text: answer.answer,
  }));

  const { error: answersError } = await supabase.from("answers").insert(rows);

  if (answersError) {
    throw answersError;
  }

  return response;
};
