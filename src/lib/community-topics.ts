import type { Topic } from "./community";

export const QUESTION_TAGS = [
  "뽑기",
  "합성·진화",
  "걸음·지도",
  "계정·기타",
] as const;
export type QuestionTag = (typeof QUESTION_TAGS)[number];
export type WalkShare = {
  kind: "today" | "total";
  steps: number;
  goal: number;
  date: string;
};
export const TOPIC_CONFIG: Record<
  Topic,
  {
    color: string;
    eyebrow: string;
    title: string;
    hint: string;
    titlePlaceholder: string;
    bodyPlaceholder: string;
  }
> = {
  자유: {
    color: "#FF5A1F",
    eyebrow: "LIFE MOMENTS",
    title: "오늘의 작은 순간",
    hint: "사진과 함께, 편하게 나누는 우리 일상",
    titlePlaceholder: "오늘 어떤 일이 있었나요?",
    bodyPlaceholder: "소소한 일상도 좋아요. 사진과 함께 친구들에게 들려주세요.",
  },
  자랑: {
    color: "#A855F7",
    eyebrow: "MY ANIMALS",
    title: "내 동물, 오늘의 주인공",
    hint: "소중한 동물 친구들을 골라 자랑해요",
    titlePlaceholder: "이 친구를 소개합니다!",
    bodyPlaceholder:
      "어떻게 만났나요? 뽑기 성공기나 애정하는 이유를 들려주세요.",
  },
  질문: {
    color: "#0EA5E9",
    eyebrow: "ASK THE CLUB",
    title: "같이 고민하면 쉬워요",
    hint: "궁금한 점을 남기고 친구들의 답변을 받아요",
    titlePlaceholder: "어떤 점이 궁금한가요?",
    bodyPlaceholder:
      "어느 화면에서, 무엇을 하다가 궁금했는지 알려주세요. 사진도 첨부할 수 있어요.",
  },
  산책: {
    color: "#10B981",
    eyebrow: "WALK TOGETHER",
    title: "오늘도 한 걸음 더",
    hint: "걸음 기록과 산책 풍경을 함께 나눠요",
    titlePlaceholder: "오늘의 산책은 어땠나요?",
    bodyPlaceholder:
      "걸으면서 만난 풍경, 오늘의 목표, 함께한 동물 이야기를 들려주세요.",
  },
};

export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
