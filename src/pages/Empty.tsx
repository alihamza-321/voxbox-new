import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Empty = () => {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <Card className="shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-semibold">Coming Soon</CardTitle>
            <CardDescription>Content for this section will appear here.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">This page is intentionally left empty for now.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Empty;


