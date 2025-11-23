"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useState } from "react";
import { Plus, X, Eye } from "lucide-react";

interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  status: "active" | "draft";
}

const mockTemplates: Template[] = [
  {
    id: "1",
    name: "Welcome Message",
    content: "Hello {{name}}, welcome to easyMO! How can we help you today?",
    variables: ["name"],
    status: "active",
  },
  {
    id: "2",
    name: "Order Confirmation",
    content: "Your order {{order_id}} has been confirmed. Total: {{amount}}",
    variables: ["order_id", "amount"],
    status: "active",
  },
];

export function TemplateEditor() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    content: "",
  });

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
    });
    setIsEditing(false);
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setFormData({ name: "", content: "" });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (selectedTemplate) {
      // Update existing
      setTemplates(
        templates.map((t) =>
          t.id === selectedTemplate.id
            ? { ...t, name: formData.name, content: formData.content }
            : t
        )
      );
    } else {
      // Create new
      const newTemplate: Template = {
        id: Math.random().toString(),
        name: formData.name,
        content: formData.content,
        variables: extractVariables(formData.content),
        status: "draft",
      };
      setTemplates([...templates, newTemplate]);
    }
    setIsEditing(false);
  };

  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    return matches ? matches.map((m) => m.replace(/\{\{|\}\}/g, "")) : [];
  };

  const insertVariable = (variable: string) => {
    setFormData({
      ...formData,
      content: formData.content + `{{${variable}}}`,
    });
  };

  const renderPreview = () => {
    let preview = formData.content;
    const variables = extractVariables(formData.content);
    variables.forEach((v) => {
      preview = preview.replace(`{{${v}}}`, `[${v.toUpperCase()}]`);
    });
    return preview;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Template List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Templates</h3>
          <Button size="sm" onClick={handleNewTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        </div>
        <div className="space-y-2">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedTemplate?.id === template.id
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{template.name}</span>
                <Badge
                  variant={template.status === "active" ? "success" : "secondary"}
                  className="text-xs"
                >
                  {template.status}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {template.content}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* Editor */}
      <Card className="lg:col-span-2 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedTemplate ? "Edit Template" : "New Template"}
          </h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            {isEditing && (
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            )}
            {!isEditing && selectedTemplate && (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Template Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={!isEditing && !!selectedTemplate}
            placeholder="e.g., Welcome Message"
          />

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Message Content
            </label>
            <textarea
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              disabled={!isEditing && !!selectedTemplate}
              rows={6}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
              placeholder="Type your message here. Use {{variable}} for dynamic content."
            />
          </div>

          {/* Variable Insertion */}
          {(isEditing || !selectedTemplate) && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Insert Variables
              </label>
              <div className="flex flex-wrap gap-2">
                {["name", "phone", "order_id", "amount", "date"].map((v) => (
                  <Button
                    key={v}
                    variant="secondary"
                    size="sm"
                    onClick={() => insertVariable(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Variables Display */}
          {formData.content && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Detected Variables
              </label>
              <div className="flex flex-wrap gap-2">
                {extractVariables(formData.content).map((v, i) => (
                  <Badge key={i} variant="outline">
                    {v}
                  </Badge>
                ))}
                {extractVariables(formData.content).length === 0 && (
                  <span className="text-sm text-gray-500">No variables detected</span>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {showPreview && formData.content && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Preview
              </label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {renderPreview()}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
