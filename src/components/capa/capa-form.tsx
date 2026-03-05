"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  users: { id: string; name: string }[];
}

export function CapaForm({ users }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("other");
  const [slaHours, setSlaHours] = useState("24");
  const [assignedToId, setAssignedToId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/capa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description") || null,
          priority,
          category,
          slaHours: Number(slaHours),
          assignedToId: assignedToId || null,
          dueDate: form.get("dueDate") || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка");
      }
      const ticket = await res.json();
      router.push(`/capa/${ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        <Label htmlFor="title">Название проблемы *</Label>
        <Input id="title" name="title" required placeholder="Кратко опишите отклонение" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Описание</Label>
        <Textarea id="description" name="description" placeholder="Подробное описание: что произошло, где, когда" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Приоритет</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Критический (2ч)</SelectItem>
              <SelectItem value="high">Высокий (24ч)</SelectItem>
              <SelectItem value="medium">Средний (48ч)</SelectItem>
              <SelectItem value="low">Низкий (72ч)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Категория</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="temperature">Температура</SelectItem>
              <SelectItem value="hygiene">Гигиена</SelectItem>
              <SelectItem value="packaging">Упаковка</SelectItem>
              <SelectItem value="quality">Качество</SelectItem>
              <SelectItem value="process">Процесс</SelectItem>
              <SelectItem value="equipment">Оборудование</SelectItem>
              <SelectItem value="other">Другое</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>SLA (часов)</Label>
          <Select value={slaHours} onValueChange={setSlaHours}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 часа</SelectItem>
              <SelectItem value="24">24 часа</SelectItem>
              <SelectItem value="48">48 часов</SelectItem>
              <SelectItem value="72">72 часа</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ответственный</Label>
          <Select value={assignedToId} onValueChange={setAssignedToId}>
            <SelectTrigger><SelectValue placeholder="Выберите..." /></SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Создание..." : "Создать CAPA"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/capa")}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
