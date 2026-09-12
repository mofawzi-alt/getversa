// Update this page (the content is just a fallback if you fail to update the page)
import { useT } from '@/hooks/useT';

const Index = () => {
  const { t } = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">{t("Welcome to Your Blank App")}</h1>
        <p className="text-xl text-muted-foreground">{t("Start building your amazing project here!")}</p>
      </div>
    </div>
  );
};

export default Index;
