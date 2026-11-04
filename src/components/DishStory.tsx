import { dishById } from "@/data/dishes";
import { storyFor } from "@/data/stories";
import { SayItButton } from "@/components/SayItButton";

/**
 * Calm "Where it comes from" block: a short origin story, a few food words,
 * and how to say the dish name. Renders nothing for dishes without a story
 * (for example AI-written ones).
 */
export function DishStory({ dishId, name }: { dishId: string; name?: string }) {
  const story = storyFor(dishId);
  if (!story) return null;
  const dishName = name ?? dishById[dishId]?.name ?? "";

  return (
    <section className="dish-story" aria-labelledby={`story-${dishId}`}>
      <h3 id={`story-${dishId}`} className="dish-story__title">
        Where it comes from
      </h3>
      <p className="dish-story__text">{story.story}</p>

      {story.words && story.words.length > 0 && (
        <dl className="dish-story__words">
          {story.words.map((w) => (
            <div className="dish-story__word" key={w.term}>
              <dt>{w.term}</dt>
              <dd>{w.meaning}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="dish-story__say">
        <p>
          <span className="dish-story__say-label">Say it:</span>{" "}
          <span className="dish-story__say-text">{story.say}</span>
        </p>
        <SayItButton text={dishName} say={story.say} lang={story.lang} />
      </div>
    </section>
  );
}
