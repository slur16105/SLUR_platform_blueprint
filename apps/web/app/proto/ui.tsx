/* shadcn/ui 방식의 프리미티브 — 라이브러리가 아니라 **내 저장소로 복사해 소유하는** 컴포넌트다.
   (shadcn의 핵심 아이디어: 설치가 아니라 복사 → 마음대로 수정·확장 가능)
   홈 프로토타입은 자체 마크업으로 짜여 있어 지금은 쓰지 않지만, 상세·장바구니 등으로
   확장할 때 쓰는 기본 부품이라 함께 둔다. */

import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn 표준 유틸 — 조건부 클래스 + Tailwind 충돌 병합 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-90",
        outline: "border border-border bg-background hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:opacity-80",
        ghost: "hover:bg-secondary",
        link: "underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: "default" | "outline" | "secondary" }) {
  const styles = {
    default: "bg-primary text-primary-foreground",
    outline: "border border-border",
    secondary: "bg-secondary text-secondary-foreground",
  }[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[var(--radius)] border border-border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}
