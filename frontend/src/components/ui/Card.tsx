interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = "", onClick }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm ${onClick ? "cursor-pointer hover:shadow-md hover:border-gray-300 transition-all" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
