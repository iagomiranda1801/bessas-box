/** Âncora de scroll com offset para o header fixo. */
export function SectionAnchor({ id }: { id: string }) {
  return (
    <div
      id={id}
      className="scroll-mt-24 h-0 w-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
