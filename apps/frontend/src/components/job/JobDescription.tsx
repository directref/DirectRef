import { parseJobDescription } from '@/lib/jobDescription';

export function JobDescription({ description }: { description: string }) {
  const blocks = parseJobDescription(description);

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <h2 key={i} className="text-[17px] font-semibold text-jobs-ink mt-8 first:mt-0">
              {block.text}
            </h2>
          );
        }
        if (block.type === 'list') {
          return (
            <ul key={i} className="space-y-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5 text-[14px] text-jobs-ink-secondary leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-gold-300 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[14px] text-jobs-ink-secondary leading-relaxed">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
