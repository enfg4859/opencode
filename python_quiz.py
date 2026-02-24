import random


QUESTIONS = [
    {
        "question": "What is the result of: print(1 + 2 * 3)",
        "options": ["7", "9", "6", "3"],
        "answer": 0,
    },
    {
        "question": "Which keyword creates a function in Python?",
        "options": ["def", "function", "create", "define"],
        "answer": 0,
    },
    {
        "question": "How do you create an empty list in Python?",
        "options": ["[]", "{}", "()", "none"],
        "answer": 0,
    },
    {
        "question": "What does len('hello') return?",
        "options": ["5", "4", "6", "None"],
        "answer": 0,
    },
    {
        "question": "Which statement reads input from the user?",
        "options": ["input()", "read()", "scan()", "echo()"],
        "answer": 0,
    },
]


def run_quiz() -> None:
    questions = QUESTIONS.copy()
    random.shuffle(questions)

    score = 0
    total = len(questions)

    for idx, q in enumerate(questions, 1):
        print(f"\nQuestion {idx}/{total}")
        print(q["question"])

        for i, option in enumerate(q["options"], 1):
            print(f"  {i}. {option}")

        while True:
            choice = input("Your answer (1-4): ").strip()

            if choice.isdigit() and 1 <= int(choice) <= len(q["options"]):
                break

            print("Please enter a number between 1 and 4.")

        selected = int(choice) - 1
        if selected == q["answer"]:
            score += 1
            print("Correct!")
        else:
            correct_text = q["options"][q["answer"]]
            print(f"Wrong. Correct answer: {correct_text}")

    print(f"\nFinal score: {score}/{total}")
    print(f"Accuracy: {score / total:.0%}")


if __name__ == "__main__":
    print("Python Quiz")
    print("Answer 5 short questions and test your basics.")
    run_quiz()
