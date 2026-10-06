import asyncio
from typing import Callable, Coroutine, Any

class TaskQueue:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.worker_task = None

    def start(self):
        self.worker_task = asyncio.create_task(self._worker())

    async def _worker(self):
        while True:
            # Blokir hingga ada item baru di antrean
            func, args, kwargs, future = await self.queue.get()
            try:
                result = await func(*args, **kwargs)
                future.set_result(result)
            except Exception as e:
                future.set_exception(e)
            finally:
                self.queue.task_done()

    async def submit(self, func: Callable[..., Coroutine[Any, Any, Any]], *args, **kwargs) -> Any:
        future = asyncio.get_event_loop().create_future()
        await self.queue.put((func, args, kwargs, future))
        return await future

# Singleton instance yang diekspor untuk seluruh aplikasi
analysis_queue = TaskQueue()
