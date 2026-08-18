import { PagePlaceholder } from "../../../../components/PagePlaceholder";

export function PhotoLibraryPage() {
  return (
    <div className="mx-auto w-full max-w-[82rem] px-6 sm:px-10 lg:px-12">
      <PagePlaceholder
        description="Uploaded and processed photo assets will be listed here."
        title="Photo Library"
      />
    </div>
  );
}
