"use client";

import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  type SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AdminLexiconEntry,
  canPublishLexiconEntry,
  LEXICON_CATEGORIES,
  LEXICON_CATEGORY_LABEL,
  LEXICON_IMAGE_TYPES,
  LEXICON_LIMITS,
  type LexiconCategory,
  slugifyTerm,
} from "@/lib/domain/lexicon";
import { cn } from "@/lib/utils";

/**
 * O formulário de uma entrada do léxico.
 *
 * ## Publicar não é um campo, é um BOTÃO, e fica no rodapé
 *
 * (E ele SALVA o formulário junto, numa escrita só. Ver `handlePublish`.)
 *
 * Um `switch` de "publicado" no meio do formulário seria coerente com a coluna
 * do banco e errado com o que a ação faz: publicar acende o nome na prosa de
 * todo mundo e o entrega ao Biblo como fonte. Isso não é um atributo do
 * registro que se alterna de passagem enquanto se conserta um acento; é um ato,
 * e um ato tem um botão, com o rótulo dizendo o que vai acontecer.
 *
 * O botão só acende com título E descrição preenchidos, e a regra que decide é
 * a mesma função que a rota chama para recusar (`canPublishLexiconEntry`). Uma
 * cópia da condição aqui seria a segunda definição de "está pronto".
 *
 * ## A imagem sobe SOZINHA, e antes de salvar o resto
 *
 * Ela tem rota própria (multipart) e é gravada na hora, o que quebra a
 * expectativa de "só vale quando eu salvar". A alternativa era segurar o
 * arquivo em memória e mandá-lo junto no salvar, o que exigiria a rota JSON
 * aceitar base64 e triplicaria o corpo. Como o upload só acontece numa entrada
 * que JÁ existe, o pior caso é uma imagem trocada num registro que não teve o
 * texto salvo, e isso a tela mostra na hora.
 *
 * É por isso que criar e editar são estados diferentes desta caixa: **no
 * cadastro novo não há como subir imagem**, porque não há linha para pendurá-la.
 * Salvou, a caixa reabre em modo de edição com o campo disponível.
 */

const CATEGORY_OPTIONS: SelectOption[] = LEXICON_CATEGORIES.map((c) => ({
  value: c,
  label: LEXICON_CATEGORY_LABEL[c],
}));

const TEXTAREA_CLASSES =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type Props = {
  /** `null` = cadastro novo. */
  entry: AdminLexiconEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recarrega a lista do servidor. */
  onChanged: () => void;
};

export function LexiconEntryDialog({ entry, open, onOpenChange, onChanged }: Props) {
  const [term, setTerm] = useState(entry?.term ?? "");
  const [aliases, setAliases] = useState((entry?.aliases ?? []).join(", "));
  const [category, setCategory] = useState<LexiconCategory>(entry?.category ?? "person");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [imageUrl, setImageUrl] = useState(entry?.imageUrl ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isNew = entry === null;
  const ready = canPublishLexiconEntry({ title, description });

  async function post(body: unknown, okMessage: string, busyKey: string): Promise<boolean> {
    setBusy(busyKey);
    try {
      const res = await fetch("/api/admin/lexicon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(
          data.error === "duplicate"
            ? "Já existe uma entrada com esse termo."
            : data.error === "incomplete"
              ? "Escreva o título e a descrição antes de publicar."
              : "Não consegui salvar. Confira os campos e tente de novo."
        );
        return false;
      }
      toast.success(okMessage);
      onChanged();
      return true;
    } catch {
      toast.error("Falha de conexão.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function payload() {
    return {
      term: term.trim(),
      // Vírgula é o separador porque é como se escreve uma lista: "Lutero,
      // Martinho". Os vazios caem no schema da rota, então uma vírgula sobrando
      // no fim não vira um apelido em branco.
      aliases: aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      category,
      title: title.trim(),
      description: description.trim(),
    };
  }

  async function handleSave() {
    if (term.trim().length < 2) {
      toast.error("O termo precisa de pelo menos duas letras.");
      return;
    }
    const ok = await post(
      isNew ? { action: "create", ...payload() } : { action: "update", id: entry.id, ...payload() },
      isNew ? "Entrada criada." : "Entrada salva.",
      "save"
    );
    if (ok && isNew) onOpenChange(false);
  }

  /**
   * Publicar GRAVA o formulário junto, numa escrita só.
   *
   * Sem isso, o botão confere o que está na tela e a rota confere a LINHA, e
   * quem preenche os campos e vai direto ao Publicar recebe "escreva o título e
   * a descrição" com os dois escritos na frente dele. "Salve primeiro" era um
   * passo que nada na tela pedia.
   */
  async function handlePublish(published: boolean) {
    if (isNew) return;
    const ok = await post(
      { action: "publish", id: entry.id, published, entry: payload() },
      published ? "Publicada: o nome já é marcado no texto." : "Voltou a rascunho.",
      "publish"
    );
    if (ok) onOpenChange(false);
  }

  async function handleDelete() {
    if (isNew) return;
    const ok = await post({ action: "delete", id: entry.id }, "Entrada apagada.", "delete");
    if (ok) onOpenChange(false);
  }

  async function handleUpload(file: File) {
    if (!entry) return;
    if (file.size > LEXICON_LIMITS.imageBytes) {
      toast.error("A imagem passa de 2 MB.");
      return;
    }
    setBusy("image");
    try {
      const form = new FormData();
      form.set("id", entry.id);
      form.set("file", file);
      const res = await fetch("/api/admin/lexicon/image", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        entry?: AdminLexiconEntry;
      };
      if (!res.ok || !data.entry) {
        toast.error(
          data.error === "bad_type"
            ? "Formato não aceito. Use JPG, PNG, WebP ou SVG."
            : data.error === "too_large"
              ? "A imagem passa de 2 MB."
              : "Não consegui subir a imagem."
        );
        return;
      }
      setImageUrl(data.entry.imageUrl);
      toast.success("Imagem atualizada.");
      onChanged();
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleClearImage() {
    if (!entry) return;
    const ok = await post({ action: "clear-image", id: entry.id }, "Imagem removida.", "image");
    if (ok) setImageUrl(null);
  }

  const slug = entry?.slug ?? slugifyTerm(term);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nova entrada" : entry.term}</DialogTitle>
          <DialogDescription>
            {/* O slug aparece porque ele é o ENDEREÇO do cartão e não muda mais
                depois de criado (ver `updateLexiconEntry`). Quem for renomear um
                termo precisa saber disso antes, não depois. */}
            {slug ? `/api/lexicon/${slug}` : "o endereço sai do termo"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lex-term">Termo</Label>
              <Input
                id="lex-term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Habacuque"
                maxLength={LEXICON_LIMITS.term}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <Select
                items={CATEGORY_OPTIONS}
                value={category}
                onValueChange={(v) => setCategory((v as LexiconCategory) ?? "person")}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lex-aliases">Apelidos</Label>
            <Input
              id="lex-aliases"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="Lutero, Martinho"
            />
            <p className="text-[11px] text-scriba-ink-mute">
              As outras formas do mesmo nome, separadas por vírgula. Todas abrem este cartão.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lex-title">Título do cartão</Label>
            <Input
              id="lex-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Habacuque, o profeta que reclamou"
              maxLength={LEXICON_LIMITS.title}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lex-description">Descrição</Label>
            <textarea
              id="lex-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              maxLength={LEXICON_LIMITS.description}
              placeholder="O que a pessoa lê ao tocar no nome. O Biblo também recebe este texto como fonte quando a conversa toca esta entrada."
              className={TEXTAREA_CLASSES}
            />
            <p className="text-right text-[11px] text-scriba-ink-mute">
              {description.length}/{LEXICON_LIMITS.description}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Imagem</Label>
            {isNew ? (
              <p className="text-[12px] text-scriba-ink-mute">
                Salve a entrada primeiro; depois disso o campo aparece aqui.
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md border border-scriba-hairline bg-muted">
                  {imageUrl ? (
                    <Image src={imageUrl} alt="" fill sizes="7rem" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-scriba-ink-mute">
                      <ImageOff className="size-4" />
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <input
                    ref={fileRef}
                    type="file"
                    accept={LEXICON_IMAGE_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(file);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy === "image"}
                      onClick={() => fileRef.current?.click()}
                    >
                      {busy === "image" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Upload className="size-3.5" />
                      )}
                      {imageUrl ? "Trocar" : "Subir"}
                    </Button>
                    {imageUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy === "image"}
                        onClick={() => void handleClearImage()}
                      >
                        Remover
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-scriba-ink-mute">
                    JPG, PNG, WebP ou SVG, até 2 MB. SVG serve para mapa e planta, que em foto
                    borram no zoom.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={busy !== null}
                onClick={() => void handleDelete()}
              >
                <Trash2 className="size-3.5" />
                Apagar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={handleSave}>
              {busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Salvar
            </Button>
            {!isNew &&
              (entry.published ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => void handlePublish(false)}
                >
                  Voltar a rascunho
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={busy !== null || !ready}
                  onClick={() => void handlePublish(true)}
                  className={cn(!ready && "opacity-60")}
                  title={ready ? undefined : "Escreva o título e a descrição primeiro"}
                >
                  Publicar
                </Button>
              ))}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
