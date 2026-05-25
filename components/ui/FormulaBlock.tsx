import katex from "katex";

export function FormulaBlock({
  expression,
  display = true,
}: {
  expression: string;
  display?: boolean;
}) {
  const html = katex.renderToString(expression, {
    displayMode: display,
    throwOnError: false,
    output: "html",
  });

  return (
    <span
      className={display ? "block my-4 text-center" : "inline"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
