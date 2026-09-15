import { Skeleton } from '@/components/ui/skeleton';

const SHIMMER_CLASS = 'skeleton-shimmer animate-none bg-transparent';

type BarProps = { className: string };

function Bar({ className }: BarProps) {
  return <Skeleton className={`${SHIMMER_CLASS} ${className}`} />;
}

type FieldSkeletonProps = { labelWidth: string; control?: string };

function FieldSkeleton({ labelWidth, control = 'h-8 rounded-full' }: FieldSkeletonProps) {
  return (
    <div className='flex flex-col gap-3'>
      <Bar className={`h-2.5 rounded-full ${labelWidth}`} />
      <Bar className={`w-full ${control}`} />
    </div>
  );
}

export default function ListingFormSkeleton() {
  return (
    <div
      className='surface-panel hairline mx-auto flex max-w-2xl flex-col gap-7 rounded-[1.7rem] p-7 sm:p-9'
      aria-hidden
    >
      <FieldSkeleton labelWidth='w-24' />
      <FieldSkeleton labelWidth='w-24' control='h-16 rounded-2xl' />

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
        <FieldSkeleton labelWidth='w-20' />
        <FieldSkeleton labelWidth='w-20' />
        <FieldSkeleton labelWidth='w-16' />
        <FieldSkeleton labelWidth='w-28' />
      </div>

      <div className='flex flex-col gap-3'>
        <Bar className='h-2.5 w-32 rounded-full' />
        <Bar className='h-18 w-full rounded-2xl' />
        <div className='grid grid-cols-2 gap-5'>
          <FieldSkeleton labelWidth='w-12' />
          <FieldSkeleton labelWidth='w-12' />
        </div>
      </div>

      <div className='flex flex-col gap-3'>
        <Bar className='h-2.5 w-16 rounded-full' />
        <div className='grid grid-cols-3 gap-3'>
          <Bar className='aspect-3/4 w-full rounded-2xl' />
          <Bar className='aspect-3/4 w-full rounded-2xl' />
          <Bar className='aspect-3/4 w-full rounded-2xl' />
        </div>
      </div>

      <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
        <FieldSkeleton labelWidth='w-14' />
        <FieldSkeleton labelWidth='w-14' />
      </div>

      <Bar className='h-18 w-full rounded-2xl' />
      <Bar className='h-12 w-full rounded-full' />
    </div>
  );
}
