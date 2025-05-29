import React, { useState } from "react";

const ScrapePanel: React.FC = () => {
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleScrape = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, selector }),
      });
      const data = await res.json();
      if (data.content) {
        setResult(data.content);
      } else if (data.error) {
        setError(data.error);
      } else {
        setError("Unknown error");
      }
    } catch (e: any) {
      setError(e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto bg-white rounded shadow">
      <h2 className="text-lg font-bold mb-2">Webpage Scraper</h2>
      <div className="mb-2">
        <input
          className="border p-2 w-full mb-2"
          type="text"
          placeholder="Enter URL (e.g. https://example.com)"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
        <input
          className="border p-2 w-full mb-2"
          type="text"
          placeholder="CSS Selector (optional, e.g. .main-content)"
          value={selector}
          onChange={e => setSelector(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={handleScrape}
          disabled={loading || !url}
        >
          {loading ? "Scraping..." : "Scrape"}
        </button>
      </div>
      {error && <div className="text-red-600 mb-2">Error: {error}</div>}
      {result && (
        <div className="border p-2 mt-2 overflow-auto max-h-96" style={{ background: "#fafafa" }}>
          <div dangerouslySetInnerHTML={{ __html: result }} />
        </div>
      )}
    </div>
  );
};

export default ScrapePanel; 