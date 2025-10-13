import React from "react";
import { createRoot } from "react-dom/client";
import { PlusCircle, Star, FileText, MapPin } from "lucide-react";
import { useWidgetProps } from "../use-widget-props";

function getResultIcon(result) {
  const type = result["@type"] || "";
  if (type.includes("Place")) return MapPin;
  if (type.includes("Article")) return FileText;
  return Star;
}

function getResultTitle(result) {
  return result.name || result.title || result.headline || "Untitled";
}

function getResultSubtitle(result) {
  // Try various Schema.org properties
  return result.city || result.location || result.publisher || result.description?.slice(0, 50);
}

function getResultImage(result) {
  // Try direct properties first
  if (result.thumbnail) return result.thumbnail;
  if (result.image) return result.image;
  if (result.thumbnailUrl) return result.thumbnailUrl;
  
  // Check schema_object for nested image
  if (result.schema_object?.image) {
    const schemaImage = result.schema_object.image;
    // Handle if it's an array (take first)
    if (Array.isArray(schemaImage)) {
      return schemaImage[0];
    }
    return schemaImage;
  }
  
  return null;
}

function getResultRating(result) {
  // Use score as rating if available, otherwise try other rating properties
  if (result.score !== undefined && result.score !== null) {
    return result.score;
  }
  return result.rating || result.aggregateRating?.ratingValue || null;
}

function ResultItem({ result, index, isLast }) {
  const [expanded, setExpanded] = React.useState(false);
  const Icon = getResultIcon(result);
  const title = getResultTitle(result);
  const subtitle = getResultSubtitle(result);
  const image = getResultImage(result);
  const rating = getResultRating(result);
  const fullDescription = result.description || result.schema_object?.description || "";
  const hasFullDescription = fullDescription && fullDescription.length > 50;

  return (
    <div
      key={result.id || result.url || index}
      className="px-3 -mx-2 rounded-2xl hover:bg-black/5"
    >
      <div
        style={{
          borderBottom: isLast ? "none" : "1px solid rgba(0, 0, 0, 0.05)",
        }}
        className="flex w-full items-center hover:border-black/0! gap-2"
      >
        <div className="py-3 pr-3 min-w-0 w-full sm:w-3/5">
          <div className="flex items-center gap-3">
            {image ? (
              <img
                src={image}
                alt={title}
                className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg object-cover ring ring-black/5"
              />
            ) : (
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-black/5 flex items-center justify-center">
                <Icon className="h-5 w-5 text-black/40" strokeWidth={1.5} />
              </div>
            )}
            <div className="w-3 text-end sm:block hidden text-sm text-black/40">
              {index + 1}
            </div>
            <div className="min-w-0 sm:pl-1 flex flex-col items-start h-full w-full">
              <div className="font-medium text-sm sm:text-md truncate max-w-[40ch]">
                {title}
              </div>
              <div className="mt-1 sm:mt-0.25 flex items-center gap-3 text-black/70 text-sm">
                {rating && (
                  <div className="flex items-center gap-1">
                    <Star
                      strokeWidth={1.5}
                      className="h-3 w-3 text-black"
                    />
                    <span>
                      {typeof rating === 'number' ? rating.toFixed(1) : rating}
                    </span>
                  </div>
                )}
                {subtitle && !expanded && (
                  <div className="whitespace-nowrap truncate max-w-[30ch]">
                    {subtitle}
                  </div>
                )}
              </div>
              {hasFullDescription && (
                <div className="mt-2 w-full">
                  <div 
                    className={`text-sm text-black/70 ${expanded ? '' : 'line-clamp-2'}`}
                  >
                    {fullDescription}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(!expanded);
                    }}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {expanded ? 'Show less' : 'Show more'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="hidden sm:block text-end py-2 px-3 text-sm text-black/60 whitespace-nowrap flex-auto">
          {result["@type"] || "–"}
        </div>
        <div className="py-2 whitespace-nowrap flex justify-end">
          <PlusCircle strokeWidth={1.5} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function App() {
  const props = useWidgetProps();
  const results = props?.results || [];
  const query = props?.query || "";
  const metadata = props?.metadata || {};

  return (
    <div className="antialiased w-full text-black px-4 pb-2 border border-black/10 rounded-2xl sm:rounded-3xl overflow-hidden bg-white">
      <div className="max-w-full">
        <div className="flex flex-row items-center gap-4 sm:gap-4 border-b border-black/5 py-4">
          <div
            className="sm:w-18 w-16 aspect-square rounded-xl bg-cover bg-center bg-blue-500/10 flex items-center justify-center"
          >
            <FileText className="h-8 w-8 text-blue-600" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-base sm:text-xl font-medium">
              {query || "NLWeb Results"}
            </div>
            <div className="text-sm text-black/60">
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </div>
          </div>
          <div className="flex-auto hidden sm:flex justify-end pr-2">
            <button
              type="button"
              className="cursor-pointer inline-flex items-center rounded-full bg-blue-600 text-white px-4 py-1.5 sm:text-md text-sm font-medium hover:opacity-90 active:opacity-100"
            >
              Save Results
            </button>
          </div>
        </div>
        <div className="min-w-full text-sm flex flex-col">
          {results.map((result, i) => (
            <ResultItem
              key={result.id || result.url || i}
              result={result}
              index={i}
              isLast={i === results.length - 1}
            />
          ))}
          {results.length === 0 && (
            <div className="py-6 text-center text-black/60">
              No results found.
            </div>
          )}
        </div>
        <div className="sm:hidden px-0 pt-2 pb-2">
          <button
            type="button"
            className="w-full cursor-pointer inline-flex items-center justify-center rounded-full bg-blue-600 text-white px-4 py-2 font-medium hover:opacity-90 active:opacity-100"
          >
            Save Results
          </button>
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById("nlweb-list-root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
