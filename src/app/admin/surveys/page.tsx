"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Survey, SurveyQuestion, SurveyResponse } from "@/types/database";
import { exportToExcel } from "@/lib/excel";

export default function AdminSurveysPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);

  useEffect(() => {
    const supabase = createClient();
    Promise.resolve(
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
          router.replace("/auth/login");
          return;
        }
        const isAdminEmail = user.email?.toLowerCase() === "admin@demo.com";
        return supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
          if (data?.role !== "admin" && !isAdminEmail) {
            router.replace("/dashboard");
            return;
          }
          setIsAdmin(true);
          supabase.from("surveys").select("*").order("created_at", { ascending: false }).then(({ data }) => setSurveys((data as Survey[]) ?? []));
          supabase.from("survey_responses").select("*").then(({ data }) => setResponses((data as SurveyResponse[]) ?? []));
          supabase.from("survey_questions").select("*").then(({ data }) => setQuestions((data as SurveyQuestion[]) ?? []));
        });
      })
    ).finally(() => setLoading(false));
  }, [router]);

  function getAverageForQuestion(qId: string): number {
    const nums = responses.filter((r) => r.question_id === qId).map((r) => r.response_number).filter((n): n is number => n != null);
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  function handleExportSummary() {
    const summary = questions.map((q) => {
      const avg = getAverageForQuestion(q.id);
      const count = responses.filter((r) => r.question_id === q.id).length;
      return { Question: q.question_text, "Avg Score": avg.toFixed(2), Responses: count };
    });
    exportToExcel(summary, "Survey Summary", "survey_summary");
  }

  if (loading || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto card text-center">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gco-primary">Surveys</h1>
        <div className="flex gap-2">
          <button type="button" onClick={handleExportSummary} className="btn-secondary text-sm">Export summary</button>
          <Link href="/admin" className="btn-secondary">Back to Admin</Link>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Surveys & analysis</h2>
        {surveys.length === 0 ? (
          <p className="text-gray-500">No surveys yet. Create one in Supabase or add a survey form.</p>
        ) : (
          <ul className="space-y-4">
            {surveys.map((s) => {
              const qs = questions.filter((q) => q.survey_id === s.id);
              const respCount = responses.filter((r) => r.survey_id === s.id).length;
              return (
                <li key={s.id} className="border-b border-gray-100 pb-4">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-gray-500">{respCount} responses</p>
                  <ul className="mt-2 text-sm">
                    {qs.map((q) => (
                      <li key={q.id}>— {q.question_text}: avg {getAverageForQuestion(q.id).toFixed(2)}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
