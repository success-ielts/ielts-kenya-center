export type ListeningQuestion = {
  id: number;
  prompt: string;
  answer: string;
  placeholder?: string;
};

export const listeningPartOne = {
  title: 'Part 1 • Community centre registration',
  context: 'An original IELTS-style practice conversation between a learner and a community centre receptionist.',
  script: `Receptionist: Good morning, Riverside Community Centre. How can I help you?
Learner: Hi. I would like to register for the evening English conversation programme.
Receptionist: Certainly. The programme starts on Tuesday 14 October and runs for six weeks.
Learner: Great. What time does the class begin?
Receptionist: It begins at 6:30 p.m. and finishes at 8:00 p.m.
Learner: And where is it held?
Receptionist: In Room 4, on the second floor. Please use the entrance beside the library.
Learner: Is there a registration fee?
Receptionist: Yes. The full six-week programme costs 2,400 shillings. Students can pay in two instalments.
Learner: I am a university student. Is there a student discount?
Receptionist: Yes, with a valid student card, the fee is 2,000 shillings.
Learner: Perfect. My name is Daniel Otieno.
Receptionist: Thank you, Daniel. Could I also have your phone number?
Learner: It is 0718 462 930.
Receptionist: And your email address?
Learner: daniel.otieno@example.com.
Receptionist: Excellent. You are now registered. Please arrive ten minutes early on the first evening.`,
  questions: [
    { id: 1, prompt: 'The programme lasts for ______ weeks.', answer: 'six', placeholder: 'one word' },
    { id: 2, prompt: 'The class starts at ______ p.m.', answer: '6:30', placeholder: 'a time' },
    { id: 3, prompt: 'Classes take place in Room ______.', answer: '4', placeholder: 'a number' },
    { id: 4, prompt: 'The standard programme fee is ______ shillings.', answer: '2400', placeholder: 'a number' },
    { id: 5, prompt: 'Students with a valid student card pay ______ shillings.', answer: '2000', placeholder: 'a number' },
    { id: 6, prompt: 'The learner’s first name is ______.', answer: 'Daniel', placeholder: 'one word' },
    { id: 7, prompt: 'The learner’s surname is ______.', answer: 'Otieno', placeholder: 'one word' },
    { id: 8, prompt: 'The phone number begins with ______.', answer: '0718', placeholder: 'four digits' },
    { id: 9, prompt: 'The learner’s email provider is ______.', answer: 'example.com', placeholder: 'the domain' },
    { id: 10, prompt: 'Learners should arrive ______ minutes early.', answer: 'ten', placeholder: 'a number' },
  ] satisfies ListeningQuestion[],
};

export function normalizeListeningAnswer(value: string) {
  return value.trim().toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
}

export function isListeningAnswerCorrect(input: string, answer: string) {
  const value = normalizeListeningAnswer(input);
  const target = normalizeListeningAnswer(answer);
  if (value === target) return true;
  const numberAliases: Record<string, string[]> = {
    six: ['6'],
    ten: ['10'],
    'two thousand': ['2000', '2,000'],
    'twenty four hundred': ['2400', '2,400'],
  };
  return (numberAliases[target] || []).map(normalizeListeningAnswer).includes(value);
}
