import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import * as d3 from "d3";
import "./MindMap.css";

const MindMap = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const noteId = searchParams.get("noteId");
  
  const [mindMapData, setMindMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!noteId) {
      setError("No note ID provided. Please go back and select a note.");
      setLoading(false);
      return;
    }

    const fetchMindMap = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("📤 Requesting mind map for noteId:", noteId);
        
        const res = await axios.post("http://localhost:5000/api/ai/mindmap", { noteId });
        
        console.log("📥 Mind map response:", res.data);
        
        if (res.data.mindmap) {
          setMindMapData(res.data.mindmap);
        } else {
          throw new Error("Invalid mind map format received from server");
        }
      } catch (error) {
        console.error("❌ Mind map generation failed:", error);
        setError(error.response?.data?.error || error.message || "Failed to generate mind map");
      } finally {
        setLoading(false);
      }
    };

    fetchMindMap();
  }, [noteId]);

  useEffect(() => {
    if (!mindMapData || !svgRef.current) return;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // Create zoom behavior
    const g = svg.append("g");
    
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom);

    // Create hierarchy
    const root = d3.hierarchy(mindMapData);
    
    // Create tree layout
    const treeLayout = d3.tree()
      .size([height - 100, width - 200])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));
    
    treeLayout(root);

    // Adjust positions to center the tree
    const nodes = root.descendants();
    const links = root.links();

    // Center the root node
    const offsetX = width / 2 - 100;
    const offsetY = 50;

    // Draw links
    g.selectAll(".link")
      .data(links)
      .join("path")
      .attr("class", "link")
      .attr("d", d3.linkHorizontal()
        .x(d => d.y + offsetX)
        .y(d => d.x + offsetY))
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-width", 2)
      .attr("opacity", 0)
      .transition()
      .duration(800)
      .attr("opacity", 1);

    // Draw nodes
    const node = g.selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.y + offsetX},${d.x + offsetY})`)
      .style("opacity", 0);

    // Add circles for nodes
    node.append("circle")
      .attr("r", d => d.depth === 0 ? 40 : 30)
      .attr("fill", d => {
        if (d.depth === 0) return "#667eea";
        if (d.depth === 1) return "#764ba2";
        return "#f093fb";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 3);

    // Add text labels
    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.depth === 0 ? 0 : (d.children ? -35 : 35))
      .attr("text-anchor", d => d.depth === 0 ? "middle" : (d.children ? "end" : "start"))
      .text(d => d.data.name)
      .attr("fill", d => d.depth === 0 ? "#fff" : "#333")
      .attr("font-size", d => d.depth === 0 ? "16px" : "14px")
      .attr("font-weight", d => d.depth === 0 ? "bold" : "normal")
      .style("pointer-events", "none")
      .each(function(d) {
        const text = d3.select(this);
        const words = d.data.name.split(/\s+/);
        const lineHeight = 1.1;
        const maxWidth = d.depth === 0 ? 70 : 150;
        
        if (words.length > 1) {
          text.text("");
          let line = [];
          let lineNumber = 0;
          let tspan = text.append("tspan")
            .attr("x", text.attr("x"))
            .attr("dy", 0);
          
          words.forEach(word => {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
              line.pop();
              tspan.text(line.join(" "));
              line = [word];
              tspan = text.append("tspan")
                .attr("x", text.attr("x"))
                .attr("dy", `${lineHeight}em`)
                .text(word);
              lineNumber++;
            }
          });
          
          // Adjust vertical position for multi-line text
          if (lineNumber > 0) {
            text.attr("dy", `-${lineNumber * 0.5}em`);
          }
        }
      });

    // Add descriptions on hover
    node.append("title")
      .text(d => d.data.description || d.data.name);

    // Animate nodes
    node.transition()
      .duration(800)
      .delay((d, i) => i * 50)
      .style("opacity", 1);

    // Initial zoom to fit content
    const bounds = g.node().getBBox();
    const fullWidth = bounds.width;
    const fullHeight = bounds.height;
    const midX = bounds.x + fullWidth / 2;
    const midY = bounds.y + fullHeight / 2;
    
    const scale = 0.8 / Math.max(fullWidth / width, fullHeight / height);
    const translate = [width / 2 - scale * midX, height / 2 - scale * midY];
    
    svg.call(zoom.transform, d3.zoomIdentity
      .translate(translate[0], translate[1])
      .scale(scale));

  }, [mindMapData]);

  const handleDownload = () => {
    const svg = svgRef.current;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mindmap.svg";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="mindmap-container">
        <button 
          onClick={() => navigate("/dashboard")} 
          style={{
            backgroundColor: "#fff",
            color: "#764ba2",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)",
            marginBottom: "20px"
          }}
        >
          ⬅ Back to Dashboard
        </button>
        <div className="loading">
          <h2>🕸 Generating Mind Map...</h2>
          <p>Creating visual connections between concepts...</p>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mindmap-container">
        <div className="error">
          <h2>❌ Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate("/dashboard")}>← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mindmap-container">
      <div className="mindmap-header">
        <button onClick={() => navigate("/dashboard")} className="back-btn">
          ← Back to Dashboard
        </button>
        <h2>🕸 Interactive Mind Map</h2>
        <div className="mindmap-controls">
          <p className="hint">💡 Drag to pan • Scroll to zoom • Hover for details</p>
          <button onClick={handleDownload} className="download-btn">
            ⬇️ Download SVG
          </button>
        </div>
      </div>

      <div ref={containerRef} className="mindmap-canvas">
        <svg ref={svgRef}></svg>
      </div>

      <div className="mindmap-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ background: "#667eea" }}></div>
          <span>Main Topic</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: "#764ba2" }}></div>
          <span>Key Concepts</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: "#f093fb" }}></div>
          <span>Details</span>
        </div>
      </div>
    </div>
  );
};

export default MindMap;