export const writingPractice = {
  task1: {
    title: 'Writing Task 1',
    prompt: 'The table below shows the percentage of adult learners who attended evening language classes in three years. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    data: 'Year  | Centre A | Centre B | Centre C\n2022  | 42%      | 35%      | 28%\n2023  | 48%      | 39%      | 31%\n2024  | 55%      | 44%      | 37%',
    minWords: 150,
  },
  task2: {
    title: 'Writing Task 2',
    prompt: 'Some people believe that students should study only subjects that are useful for future employment. Others believe that students should study a wider range of subjects. Discuss both views and give your own opinion.',
    minWords: 250,
  },
};

export const countWords = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
